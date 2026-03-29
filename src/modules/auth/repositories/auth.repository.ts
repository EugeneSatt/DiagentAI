import { Injectable } from '@nestjs/common';
import { Prisma, RefreshSession, User } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findUserByEmail(email: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });
  }

  findUserById(id: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { id },
    });
  }

  createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prismaService.user.create({ data });
  }

  upsertDevice(params: {
    userId: string;
    deviceId: string;
    name?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    return this.prismaService.device
      .upsert({
        where: {
          userId_deviceId: {
            userId: params.userId,
            deviceId: params.deviceId,
          },
        },
        create: {
          userId: params.userId,
          deviceId: params.deviceId,
          name: params.name,
          metadata: params.metadata,
        },
        update: {
          lastSeenAt: new Date(),
          name: params.name,
          metadata: params.metadata,
        },
      })
      .then(() => undefined);
  }

  createRefreshSession(
    data: Prisma.RefreshSessionCreateInput,
  ): Promise<RefreshSession> {
    return this.prismaService.refreshSession.create({ data });
  }

  findRefreshSessionById(id: string): Promise<RefreshSession | null> {
    return this.prismaService.refreshSession.findUnique({
      where: { id },
    });
  }

  updateRefreshSession(
    id: string,
    data: Prisma.RefreshSessionUpdateInput,
  ): Promise<RefreshSession> {
    return this.prismaService.refreshSession.update({
      where: { id },
      data,
    });
  }
}
