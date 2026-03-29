import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  TimelineEventType,
  TimelineSourceKind,
} from '../../../domain/common/enums/domain.enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SyncHealthDto } from '../dto/sync-health.dto';

@Injectable()
export class HealthRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async sync(userId: string, dto: SyncHealthDto) {
    await this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        for (const sample of dto.samples) {
          const metric = await tx.healthMetric.upsert({
            where: {
              userId_type_externalId: {
                userId,
                type: sample.type,
                externalId:
                  sample.externalId ?? `${sample.type}:${sample.sampledAt}`,
              },
            },
            create: {
              userId,
              type: sample.type,
              value: new Prisma.Decimal(sample.value),
              unit: sample.unit,
              sourceApp: sample.sourceApp,
              externalId:
                sample.externalId ?? `${sample.type}:${sample.sampledAt}`,
              sampledAt: new Date(sample.sampledAt),
              startAt: sample.startAt ? new Date(sample.startAt) : undefined,
              endAt: sample.endAt ? new Date(sample.endAt) : undefined,
              metadata: sample.metadata as Prisma.InputJsonValue,
            },
            update: {
              value: new Prisma.Decimal(sample.value),
              unit: sample.unit,
              sourceApp: sample.sourceApp,
              sampledAt: new Date(sample.sampledAt),
              startAt: sample.startAt ? new Date(sample.startAt) : undefined,
              endAt: sample.endAt ? new Date(sample.endAt) : undefined,
              metadata: sample.metadata as Prisma.InputJsonValue,
            },
          });

          const eventType = this.mapHealthMetricToTimelineType(sample.type);
          await tx.timelineEvent.create({
            data: {
              userId,
              type: eventType,
              sourceKind: TimelineSourceKind.HEALTHKIT,
              sourceId: metric.id,
              startAt: sample.startAt
                ? new Date(sample.startAt)
                : new Date(sample.sampledAt),
              endAt: sample.endAt
                ? new Date(sample.endAt)
                : new Date(sample.sampledAt),
              payload: {
                metricId: metric.id,
                type: sample.type,
                value: sample.value,
                unit: sample.unit,
              },
            },
          });
        }
      },
    );
  }

  private mapHealthMetricToTimelineType(type: string): TimelineEventType {
    switch (type) {
      case 'GLUCOSE':
        return TimelineEventType.GLUCOSE;
      case 'INSULIN':
        return TimelineEventType.INSULIN;
      case 'SLEEP':
        return TimelineEventType.SLEEP;
      case 'HEART_RATE':
        return TimelineEventType.HEART_RATE;
      default:
        return TimelineEventType.ACTIVITY;
    }
  }
}
