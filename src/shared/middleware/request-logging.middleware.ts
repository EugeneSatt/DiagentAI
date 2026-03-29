import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Response } from 'express';
import { RequestContext } from '../types/request-context.interface';
import {
  compactLogPayload,
  sanitizeForLog,
  summarizeUploadedFiles,
} from '../utils/http-logging.util';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HttpRequest');

  use(req: RequestContext, res: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    const requestId = this.resolveRequestId(req);

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    this.logger.log(
      JSON.stringify(
        compactLogPayload({
          event: 'http.request.started',
          requestId,
          method: req.method,
          path: req.originalUrl || req.url,
          ip: this.resolveIp(req),
          deviceId: this.getSingleHeader(req.headers['x-device-id']),
          contentType: this.getSingleHeader(req.headers['content-type']),
          contentLength: this.getSingleHeader(req.headers['content-length']),
          userAgent: this.getSingleHeader(req.headers['user-agent']),
        }),
      ),
    );

    req.on('aborted', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.logger.warn(
        JSON.stringify(
          compactLogPayload({
            event: 'http.request.aborted',
            requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            ip: this.resolveIp(req),
            deviceId: this.getSingleHeader(req.headers['x-device-id']),
            durationMs: Number(durationMs.toFixed(2)),
          }),
        ),
      );
    });

    res.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const payload = compactLogPayload({
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        ip: this.resolveIp(req),
        userId: req.user?.sub,
        deviceId: this.getSingleHeader(req.headers['x-device-id']),
        query: sanitizeForLog(req.query),
        params: sanitizeForLog(req.params),
        body: sanitizeForLog(req.body),
        files: summarizeUploadedFiles(req.files, req.file),
      });

      const message = JSON.stringify(payload);

      if (res.statusCode >= 500) {
        this.logger.error(message);
        return;
      }

      if (res.statusCode >= 400) {
        this.logger.warn(message);
        return;
      }

      this.logger.log(message);
    });

    res.on('close', () => {
      if (res.writableEnded) {
        return;
      }

      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      this.logger.warn(
        JSON.stringify(
          compactLogPayload({
            event: 'http.response.closed',
            requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            ip: this.resolveIp(req),
            deviceId: this.getSingleHeader(req.headers['x-device-id']),
            durationMs: Number(durationMs.toFixed(2)),
          }),
        ),
      );
    });

    next();
  }

  private resolveRequestId(req: RequestContext): string {
    const headerValue = this.getSingleHeader(req.headers['x-request-id']);
    return headerValue || randomUUID();
  }

  private resolveIp(req: RequestContext): string | undefined {
    const forwardedFor = this.getSingleHeader(req.headers['x-forwarded-for']);

    if (forwardedFor) {
      return forwardedFor.split(',')[0]?.trim();
    }

    return req.ip || req.socket.remoteAddress || undefined;
  }

  private getSingleHeader(
    headerValue: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }

    return headerValue;
  }
}
