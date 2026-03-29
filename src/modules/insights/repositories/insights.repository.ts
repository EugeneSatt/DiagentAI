import { Injectable } from '@nestjs/common';
import { InsightSeverity, InsightType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class InsightsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  getContext(userId: string) {
    return Promise.all([
      this.prismaService.labResult.findMany({
        where: { userId },
        orderBy: {
          measuredAt: 'desc',
        },
        take: 20,
      }),
      this.prismaService.meal.findMany({
        where: { userId },
        orderBy: {
          loggedAt: 'desc',
        },
        take: 20,
      }),
      this.prismaService.timelineEvent.findMany({
        where: { userId },
        orderBy: {
          startAt: 'desc',
        },
        take: 100,
      }),
    ]);
  }

  async replaceForUser(
    userId: string,
    insights: Array<{
      type: InsightType;
      severity: InsightSeverity;
      title: string;
      summary: string;
      payload: Prisma.InputJsonValue;
    }>,
  ): Promise<void> {
    await this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.insight.deleteMany({
          where: {
            userId,
          },
        });

        if (insights.length === 0) {
          return;
        }

        await tx.insight.createMany({
          data: insights.map((insight) => ({
            userId,
            type: insight.type,
            severity: insight.severity,
            title: insight.title,
            summary: insight.summary,
            payload: insight.payload,
          })),
        });
      },
    );
  }

  listLatest(userId: string) {
    return this.prismaService.insight.findMany({
      where: { userId },
      orderBy: {
        generatedAt: 'desc',
      },
    });
  }
}
