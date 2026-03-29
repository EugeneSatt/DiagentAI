import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  TimelineEventType,
  TimelineSourceKind,
} from '../../../domain/common/enums/domain.enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateManualLabResultDto } from '../dto/create-manual-lab-result.dto';
import { ListLabsQueryDto } from '../dto/list-labs.query.dto';

@Injectable()
export class LabsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async createManyWithTimeline(
    userId: string,
    items: Array<{
      normalizedName: string;
      rawName?: string;
      type: string;
      value: number;
      unit: string;
      referenceRange?: Prisma.InputJsonValue;
      status: string;
      confidence: number;
      sourceDocumentId?: string;
      measuredAt: Date;
    }>,
  ): Promise<void> {
    await this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        for (const item of items) {
          const created = await tx.labResult.create({
            data: {
              userId,
              normalizedName: item.normalizedName,
              rawName: item.rawName,
              type: item.type as never,
              value: new Prisma.Decimal(item.value),
              unit: item.unit,
              referenceRange: item.referenceRange,
              status: item.status as never,
              confidence: new Prisma.Decimal(item.confidence),
              sourceDocumentId: item.sourceDocumentId,
              measuredAt: item.measuredAt,
            },
          });

          await tx.timelineEvent.create({
            data: {
              userId,
              type: TimelineEventType.LAB,
              sourceKind: TimelineSourceKind.LAB_RESULT,
              sourceId: created.id,
              startAt: item.measuredAt,
              endAt: item.measuredAt,
              confidence: new Prisma.Decimal(item.confidence),
              payload: {
                labResultId: created.id,
                normalizedName: item.normalizedName,
                type: item.type,
                value: item.value,
                unit: item.unit,
                status: item.status,
              },
            },
          });
        }
      },
    );
  }

  async createManual(userId: string, dto: CreateManualLabResultDto) {
    await this.createManyWithTimeline(userId, [
      {
        normalizedName: dto.normalizedName,
        rawName: dto.rawName,
        type: dto.type,
        value: dto.value,
        unit: dto.unit,
        referenceRange: dto.referenceRange as Prisma.InputJsonValue,
        status: dto.status,
        confidence: dto.confidence,
        measuredAt: new Date(dto.measuredAt),
      },
    ]);
  }

  async listByUser(userId: string, query: ListLabsQueryDto) {
    const where: Prisma.LabResultWhereInput = {
      userId,
      type: query.type,
      measuredAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };

    return this.prismaService.labResult.findMany({
      where,
      orderBy: {
        measuredAt: 'desc',
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  }

  async latestByUser(userId: string, limit: number) {
    return this.prismaService.labResult.findMany({
      where: { userId },
      orderBy: {
        measuredAt: 'desc',
      },
      take: limit,
    });
  }

  async getOverviewContext(userId: string) {
    const [labs, documents, user] = await Promise.all([
      this.prismaService.labResult.findMany({
        where: { userId },
        orderBy: {
          measuredAt: 'desc',
        },
        take: 50,
      }),
      this.prismaService.document.findMany({
        where: {
          userId,
          type: 'LAB_REPORT',
        },
        orderBy: {
          uploadedAt: 'desc',
        },
        take: 20,
      }),
      this.prismaService.user.findUnique({
        where: { id: userId },
        select: {
          profile: true,
        },
      }),
    ]);

    return {
      labs,
      documents,
      profile: user?.profile ?? null,
    };
  }
}
