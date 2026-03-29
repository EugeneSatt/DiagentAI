import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';

export const DeviceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const header = request.headers['x-device-id'];
    const deviceId = Array.isArray(header) ? header[0] : header;

    if (!deviceId) {
      throw new BadRequestException('x-device-id header is required');
    }

    return deviceId;
  },
);
