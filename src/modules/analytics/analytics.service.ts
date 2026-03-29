import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSummary(userId: string) {
    const [documents, labs, meals, timelineEvents, latestInsights] =
      await Promise.all([
        this.prismaService.document.count({
          where: { userId },
        }),
        this.prismaService.labResult.count({
          where: { userId },
        }),
        this.prismaService.meal.count({
          where: { userId },
        }),
        this.prismaService.timelineEvent.groupBy({
          by: ['type'],
          where: { userId },
          _count: {
            type: true,
          },
        }),
        this.prismaService.insight.findMany({
          where: { userId },
          orderBy: {
            generatedAt: 'desc',
          },
          take: 5,
        }),
      ]);

    return {
      totals: {
        documents,
        labs,
        meals,
      },
      timelineEvents: timelineEvents.map(
        (item: (typeof timelineEvents)[number]) => ({
          type: item.type,
          count: item._count.type,
        }),
      ),
      latestInsights,
    };
  }
}
