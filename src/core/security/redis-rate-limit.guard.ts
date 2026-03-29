import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../../domain/auth/jwt-payload.interface';
import { RedisService } from '../../infrastructure/redis/redis.service';

type RateLimitedRequest = Request & {
  user?: JwtPayload;
};

@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    const ttlSeconds = this.configService.get<number>(
      'rateLimit.ttlSeconds',
      60,
    );
    const maxRequests = this.configService.get<number>(
      'rateLimit.maxRequests',
      120,
    );
    const userKey =
      request.user?.sub ??
      request.ip ??
      request.socket.remoteAddress ??
      'anonymous';
    const routeKey = `${request.method}:${request.path}`;
    const rateLimitKey = `rate-limit:${routeKey}:${userKey}`;
    const count = await this.redisService.incrementRateLimit(
      rateLimitKey,
      ttlSeconds,
    );

    if (count > maxRequests) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
