import { Injectable, NotFoundException } from '@nestjs/common';
import {
  HealthMetricType,
  MessageRole,
  Prisma,
  TimelineEventType,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export interface AssistantContextScope {
  includeLabs: boolean;
  includeMeals: boolean;
  includeGlucose: boolean;
  includeSleep: boolean;
  includeActivity: boolean;
  includeInsulin: boolean;
  includeDoctorNotes: boolean;
  includeInsights: boolean;
}

@Injectable()
export class AssistantRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async getStructuredContext(userId: string, scope: AssistantContextScope) {
    const labsPromise = scope.includeLabs
      ? this.prismaService.labResult.findMany({
          where: { userId },
          orderBy: { measuredAt: 'desc' },
          take: 10,
        })
      : Promise.resolve([]);

    const mealsPromise = scope.includeMeals
      ? this.prismaService.meal.findMany({
          where: { userId },
          orderBy: { loggedAt: 'desc' },
          take: 10,
          include: {
            components: {
              orderBy: {
                ordinal: 'asc',
              },
            },
          },
        })
      : Promise.resolve([]);

    const metricTypes = this.resolveMetricTypes(scope);
    const healthMetricsPromise =
      metricTypes.length > 0
        ? this.prismaService.healthMetric.findMany({
            where: {
              userId,
              type: {
                in: metricTypes,
              },
            },
            orderBy: { sampledAt: 'desc' },
            take: 40,
          })
        : Promise.resolve([]);

    const timelineTypes = this.resolveTimelineTypes(scope);
    const timelinePromise =
      timelineTypes.length > 0
        ? this.prismaService.timelineEvent.findMany({
            where: {
              userId,
              type: {
                in: timelineTypes,
              },
            },
            orderBy: { startAt: 'desc' },
            take: 40,
          })
        : Promise.resolve([]);

    const insightsPromise = scope.includeInsights
      ? this.prismaService.insight.findMany({
          where: { userId },
          orderBy: { generatedAt: 'desc' },
          take: 8,
        })
      : Promise.resolve([]);

    const doctorNotesPromise = scope.includeDoctorNotes
      ? this.prismaService.doctorNote.findMany({
          where: { userId },
          orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
          take: 10,
          include: {
            sourceDocument: true,
          },
        })
      : Promise.resolve([]);

    const [labs, meals, healthMetrics, timeline, insights, doctorNotes] =
      await Promise.all([
        labsPromise,
        mealsPromise,
        healthMetricsPromise,
        timelinePromise,
        insightsPromise,
        doctorNotesPromise,
      ]);

    return {
      labs,
      meals,
      healthMetrics,
      timeline,
      insights,
      doctorNotes,
      scope,
    };
  }

  async ensureConversation(userId: string, conversationId?: string) {
    if (!conversationId) {
      return this.prismaService.assistantConversation.create({
        data: {
          userId,
        },
      });
    }

    const conversation =
      await this.prismaService.assistantConversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  saveMessage(input: {
    conversationId: string;
    userId: string;
    role: MessageRole;
    contentEncrypted: string;
    structuredContext?: Prisma.InputJsonValue;
    citations?: Prisma.InputJsonValue;
  }) {
    return this.prismaService.$transaction(async (tx) => {
      const message = await tx.assistantMessage.create({
        data: input,
      });

      await tx.assistantConversation.update({
        where: {
          id: input.conversationId,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      return message;
    });
  }

  async setConversationTitleIfEmpty(conversationId: string, title: string) {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    await this.prismaService.assistantConversation.updateMany({
      where: {
        id: conversationId,
        OR: [
          {
            title: null,
          },
          {
            title: '',
          },
        ],
      },
      data: {
        title: trimmedTitle,
      },
    });
  }

  listConversations(userId: string, limit: number) {
    return this.prismaService.assistantConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getConversationMessages(
    userId: string,
    conversationId: string,
    limit: number,
  ) {
    await this.ensureConversation(userId, conversationId);

    return this.prismaService.assistantMessage.findMany({
      where: {
        userId,
        conversationId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private resolveMetricTypes(scope: AssistantContextScope): HealthMetricType[] {
    const types = new Set<HealthMetricType>();

    if (scope.includeGlucose) {
      types.add(HealthMetricType.GLUCOSE);
    }

    if (scope.includeSleep) {
      types.add(HealthMetricType.SLEEP);
    }

    if (scope.includeActivity) {
      types.add(HealthMetricType.STEPS);
      types.add(HealthMetricType.ACTIVE_ENERGY);
      types.add(HealthMetricType.HEART_RATE);
    }

    if (scope.includeInsulin) {
      types.add(HealthMetricType.INSULIN);
    }

    if (scope.includeMeals) {
      types.add(HealthMetricType.DIETARY_CARBS);
    }

    return Array.from(types);
  }

  private resolveTimelineTypes(
    scope: AssistantContextScope,
  ): TimelineEventType[] {
    const types = new Set<TimelineEventType>();

    if (scope.includeGlucose) {
      types.add(TimelineEventType.GLUCOSE);
    }

    if (scope.includeMeals) {
      types.add(TimelineEventType.MEAL);
    }

    if (scope.includeSleep) {
      types.add(TimelineEventType.SLEEP);
    }

    if (scope.includeInsulin) {
      types.add(TimelineEventType.INSULIN);
    }

    if (scope.includeLabs) {
      types.add(TimelineEventType.LAB);
    }

    if (scope.includeActivity) {
      types.add(TimelineEventType.ACTIVITY);
      types.add(TimelineEventType.HEART_RATE);
    }

    return Array.from(types);
  }
}
