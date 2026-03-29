import { Injectable, NotFoundException } from '@nestjs/common';
import { GeneratedPlanStatus, GeneratedPlanType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class PlansRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findCurrentPlan(userId: string, type: GeneratedPlanType, weekStart: Date) {
    return this.prismaService.generatedPlan.findUnique({
      where: {
        userId_type_weekStart: {
          userId,
          type,
          weekStart,
        },
      },
    });
  }

  async getGenerationContext(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
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

    const [meals, healthMetrics, labs, insights] = await Promise.all([
      this.prismaService.meal.findMany({
        where: {
          userId,
          status: 'COMPLETED',
        },
        orderBy: { loggedAt: 'desc' },
        take: 12,
      }),
      this.prismaService.healthMetric.findMany({
        where: { userId },
        orderBy: { sampledAt: 'desc' },
        take: 40,
      }),
      this.prismaService.labResult.findMany({
        where: { userId },
        orderBy: { measuredAt: 'desc' },
        take: 20,
      }),
      this.prismaService.insight.findMany({
        where: { userId },
        orderBy: { generatedAt: 'desc' },
        take: 8,
      }),
    ]);

    return {
      user,
      meals,
      healthMetrics,
      labs,
      insights,
    };
  }

  upsertGeneratedPlan(input: {
    userId: string;
    type: GeneratedPlanType;
    weekStart: Date;
    weekEnd: Date;
    title: string;
    summary: string;
    recommendation: string;
    payload: Prisma.InputJsonValue;
    preferences?: Prisma.InputJsonValue;
    model?: string;
  }) {
    return this.prismaService.generatedPlan.upsert({
      where: {
        userId_type_weekStart: {
          userId: input.userId,
          type: input.type,
          weekStart: input.weekStart,
        },
      },
      create: {
        userId: input.userId,
        type: input.type,
        weekStart: input.weekStart,
        weekEnd: input.weekEnd,
        title: input.title,
        summary: input.summary,
        recommendation: input.recommendation,
        payload: input.payload,
        preferences: input.preferences,
        model: input.model,
      },
      update: {
        status: GeneratedPlanStatus.GENERATED,
        weekEnd: input.weekEnd,
        title: input.title,
        summary: input.summary,
        recommendation: input.recommendation,
        payload: input.payload,
        preferences: input.preferences,
        model: input.model,
        failureReason: null,
        generatedAt: new Date(),
      },
    });
  }

  failGeneratedPlan(input: {
    userId: string;
    type: GeneratedPlanType;
    weekStart: Date;
    weekEnd: Date;
    failureReason: string;
    preferences?: Prisma.InputJsonValue;
    model?: string;
  }) {
    return this.prismaService.generatedPlan.upsert({
      where: {
        userId_type_weekStart: {
          userId: input.userId,
          type: input.type,
          weekStart: input.weekStart,
        },
      },
      create: {
        userId: input.userId,
        type: input.type,
        status: GeneratedPlanStatus.FAILED,
        weekStart: input.weekStart,
        weekEnd: input.weekEnd,
        title: 'План не сгенерирован',
        summary: 'Не удалось собрать план на текущую неделю.',
        recommendation:
          'Попробуй запросить план ещё раз через несколько минут.',
        payload: {},
        preferences: input.preferences,
        model: input.model,
        failureReason: input.failureReason,
      },
      update: {
        status: GeneratedPlanStatus.FAILED,
        weekEnd: input.weekEnd,
        preferences: input.preferences,
        model: input.model,
        failureReason: input.failureReason,
        generatedAt: new Date(),
      },
    });
  }
}
