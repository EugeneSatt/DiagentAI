import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { UserProfileDto } from '../dto/user-profile.dto';
import { UpdateUserProfileDto } from '../dto/update-user-profile.dto';

@Injectable()
export class UsersRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async getUserProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        timezone: true,
        locale: true,
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapUserProfile(user);
  }

  async updateUserProfile(
    userId: string,
    dto: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    const existing = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        profile: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const nextProfile = {
      ...this.normalizeProfile(existing.profile),
      ...(dto.profile ?? {}),
    };

    const updated = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        timezone: dto.timezone,
        locale: dto.locale,
        profile: nextProfile as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        timezone: true,
        locale: true,
        profile: true,
      },
    });

    return this.mapUserProfile(updated);
  }

  private mapUserProfile(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    timezone: string;
    locale: string;
    profile: Prisma.JsonValue | null;
  }): UserProfileDto {
    return {
      ...user,
      profile: this.normalizeProfile(user.profile),
    };
  }

  private normalizeProfile(profile: Prisma.JsonValue | null) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return {};
    }

    return profile as Record<string, unknown>;
  }
}
