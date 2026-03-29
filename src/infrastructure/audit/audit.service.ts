import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogInput {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  deviceId?: string;
  ipAddress?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  async record(input: CreateAuditLogInput): Promise<void> {
    await this.prismaService.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        deviceId: input.deviceId,
        ipAddress: input.ipAddress,
        metadata: input.metadata,
      },
    });
  }
}
