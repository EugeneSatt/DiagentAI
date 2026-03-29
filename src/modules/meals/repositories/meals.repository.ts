import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DocumentStatus,
  MealAiDispatchStatus,
  DocumentType,
  MealStatus,
  TimelineEventType,
  TimelineSourceKind,
} from '../../../domain/common/enums/domain.enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { toInputJsonValue } from '../../../shared/utils/json.util';
import {
  MealAggregateAnalysisResult,
  MealImageAnalysisResult,
} from '../../../domain/meals/meal-analysis.interface';
import { AnalyzeMealUploadDto } from '../dto/analyze-meal-upload.dto';
import { CreateMealDto } from '../dto/create-meal.dto';

@Injectable()
export class MealsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(userId: string, dto: CreateMealDto) {
    return this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const meal = await tx.meal.create({
          data: {
            userId,
            title: dto.title,
            description: dto.description,
            photoUrl: dto.photoUrl,
            loggedAt: new Date(dto.loggedAt),
            calories:
              dto.calories !== undefined
                ? new Prisma.Decimal(dto.calories)
                : undefined,
            carbohydrates:
              dto.carbohydrates !== undefined
                ? new Prisma.Decimal(dto.carbohydrates)
                : undefined,
            protein:
              dto.protein !== undefined
                ? new Prisma.Decimal(dto.protein)
                : undefined,
            fat:
              dto.fat !== undefined ? new Prisma.Decimal(dto.fat) : undefined,
            confidence:
              dto.confidence !== undefined
                ? new Prisma.Decimal(dto.confidence)
                : undefined,
          },
        });

        await tx.timelineEvent.create({
          data: {
            userId,
            type: TimelineEventType.MEAL,
            sourceKind: TimelineSourceKind.MEAL,
            sourceId: meal.id,
            startAt: meal.loggedAt,
            endAt: meal.loggedAt,
            confidence: meal.confidence,
            payload: {
              mealId: meal.id,
              title: meal.title,
              carbohydrates: dto.carbohydrates,
              calories: dto.calories,
            },
          },
        });

        return meal;
      },
    );
  }

  list(userId: string) {
    return this.prismaService.meal.findMany({
      where: { userId },
      orderBy: {
        loggedAt: 'desc',
      },
      include: {
        components: {
          orderBy: {
            ordinal: 'asc',
          },
        },
      },
    });
  }

  latest(userId: string, limit: number) {
    return this.prismaService.meal.findMany({
      where: { userId },
      orderBy: {
        loggedAt: 'desc',
      },
      take: limit,
    });
  }

  getDetail(userId: string, mealId: string) {
    return this.prismaService.meal.findFirstOrThrow({
      where: {
        id: mealId,
        userId,
      },
      include: {
        components: {
          orderBy: {
            ordinal: 'asc',
          },
        },
      },
    });
  }

  async createPendingAnalysis(
    userId: string,
    dto: AnalyzeMealUploadDto,
    uploadedItems: Array<{
      fileName: string;
      mimeType: string;
      bytes: number;
      imageUrl: string;
      publicId: string;
      description?: string;
    }>,
  ) {
    return this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const meal = await tx.meal.create({
          data: {
            userId,
            title: dto.title ?? 'Meal analysis',
            description: uploadedItems
              .map((item) => item.description)
              .filter(Boolean)
              .join('\n'),
            photoUrl: null,
            loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
            status: MealStatus.QUEUED,
            aiDispatchStatus: MealAiDispatchStatus.PENDING,
            metadata: {
              imageCount: uploadedItems.length,
              flow: 'meal-analysis',
              storage: 'local-staging',
            },
          },
        });

        for (const [index, item] of uploadedItems.entries()) {
          const document = await tx.document.create({
            data: {
              userId,
              type: DocumentType.MEAL_PHOTO,
              status: DocumentStatus.QUEUED,
              fileName: item.fileName,
              mimeType: item.mimeType,
              bytes: item.bytes,
              cloudinaryUrl: item.imageUrl,
              cloudinaryPublicId: item.publicId,
              metadata: {
                mealId: meal.id,
                ordinal: index,
                description: item.description,
                storage: 'local-staging',
              },
            },
          });

          await tx.mealComponent.create({
            data: {
              mealId: meal.id,
              userId,
              ordinal: index,
              imageUrl: item.imageUrl,
              description: item.description,
              sourceDocumentId: document.id,
            },
          });
        }

        return meal;
      },
    );
  }

  async getMealForAnalysis(mealId: string) {
    return this.prismaService.meal.findUniqueOrThrow({
      where: { id: mealId },
      include: {
        components: {
          orderBy: {
            ordinal: 'asc',
          },
        },
      },
    });
  }

  async markAnalysisProcessing(mealId: string, documentIds: string[]) {
    await this.prismaService.$transaction([
      this.prismaService.meal.update({
        where: { id: mealId },
        data: {
          status: MealStatus.PROCESSING,
          failureReason: null,
        },
      }),
      this.prismaService.document.updateMany({
        where: {
          id: {
            in: documentIds,
          },
        },
        data: {
          status: DocumentStatus.PROCESSING,
          failedAt: null,
          failureReason: null,
          processedAt: new Date(),
        },
      }),
    ]);
  }

  async markAiDispatchStarted(mealId: string) {
    await this.prismaService.meal.update({
      where: { id: mealId },
      data: {
        aiDispatchStatus: MealAiDispatchStatus.DISPATCHED,
        aiDispatchedAt: new Date(),
        aiDispatchFailedAt: null,
        aiDispatchFailureReason: null,
      },
    });
  }

  async attachUploadedMealAsset(input: {
    mealId: string;
    componentId: string;
    sourceDocumentId?: string | null;
    imageUrl: string;
    publicId: string;
    bytes: number;
    ordinal: number;
  }) {
    await this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.mealComponent.update({
          where: { id: input.componentId },
          data: {
            imageUrl: input.imageUrl,
          },
        });

        if (input.ordinal === 0) {
          await tx.meal.update({
            where: { id: input.mealId },
            data: {
              photoUrl: input.imageUrl,
            },
          });
        }

        if (!input.sourceDocumentId) {
          return;
        }

        await tx.document.update({
          where: { id: input.sourceDocumentId },
          data: {
            cloudinaryUrl: input.imageUrl,
            cloudinaryPublicId: input.publicId,
            bytes: input.bytes,
            metadata: {
              storage: 'cloudinary',
              mealId: input.mealId,
              ordinal: input.ordinal,
            },
          },
        });
      },
    );
  }

  async saveComponentAnalysis(input: {
    componentId: string;
    sourceDocumentId?: string | null;
    analysis: MealImageAnalysisResult;
    aiResponseEncrypted: string;
    model?: string;
  }) {
    await this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.mealComponent.update({
          where: { id: input.componentId },
          data: {
            title: input.analysis.title,
            summary: input.analysis.summary,
            calories: new Prisma.Decimal(input.analysis.totals.calories),
            carbohydrates: new Prisma.Decimal(
              input.analysis.totals.carbohydrates,
            ),
            protein: new Prisma.Decimal(input.analysis.totals.protein),
            fat: new Prisma.Decimal(input.analysis.totals.fat),
            fiber:
              input.analysis.totals.fiber !== null &&
              input.analysis.totals.fiber !== undefined
                ? new Prisma.Decimal(input.analysis.totals.fiber)
                : undefined,
            xe: new Prisma.Decimal(input.analysis.totals.xe),
            glycemicIndex: new Prisma.Decimal(input.analysis.totals.gi),
            glycemicLoad: new Prisma.Decimal(input.analysis.totals.gl),
            confidence: new Prisma.Decimal(input.analysis.confidence),
            analysis: toInputJsonValue(input.analysis),
          },
        });

        if (!input.sourceDocumentId) {
          return;
        }

        await tx.document.update({
          where: { id: input.sourceDocumentId },
          data: {
            status: DocumentStatus.COMPLETED,
            extractedAt: new Date(),
          },
        });

        await tx.documentRaw.upsert({
          where: {
            documentId: input.sourceDocumentId,
          },
          create: {
            documentId: input.sourceDocumentId,
            normalizedJson: toInputJsonValue(input.analysis),
            aiResponseEncrypted: input.aiResponseEncrypted,
            schemaVersion: 'v1',
            ocrProvider: 'comet-vision',
            model: input.model,
          },
          update: {
            normalizedJson: toInputJsonValue(input.analysis),
            aiResponseEncrypted: input.aiResponseEncrypted,
            schemaVersion: 'v1',
            ocrProvider: 'comet-vision',
            model: input.model,
          },
        });
      },
    );
  }

  async completeMealAnalysis(input: {
    mealId: string;
    userId: string;
    aggregate: MealAggregateAnalysisResult;
    loggedAt: Date;
  }) {
    await this.prismaService.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.meal.update({
          where: { id: input.mealId },
          data: {
            title: input.aggregate.title,
            summary: input.aggregate.summary,
            status: MealStatus.COMPLETED,
            aiDispatchStatus: MealAiDispatchStatus.DISPATCHED,
            aiDispatchFailedAt: null,
            aiDispatchFailureReason: null,
            calories: new Prisma.Decimal(input.aggregate.totals.calories),
            carbohydrates: new Prisma.Decimal(
              input.aggregate.totals.carbohydrates,
            ),
            protein: new Prisma.Decimal(input.aggregate.totals.protein),
            fat: new Prisma.Decimal(input.aggregate.totals.fat),
            fiber:
              input.aggregate.totals.fiber !== null &&
              input.aggregate.totals.fiber !== undefined
                ? new Prisma.Decimal(input.aggregate.totals.fiber)
                : undefined,
            xe: new Prisma.Decimal(input.aggregate.totals.xe),
            glycemicIndex: new Prisma.Decimal(input.aggregate.totals.gi),
            glycemicLoad: new Prisma.Decimal(input.aggregate.totals.gl),
            confidence: new Prisma.Decimal(input.aggregate.confidence),
            recommendations: toInputJsonValue(input.aggregate.recommendations),
            failureReason: null,
          },
        });

        await tx.timelineEvent.deleteMany({
          where: {
            sourceKind: TimelineSourceKind.MEAL,
            sourceId: input.mealId,
          },
        });

        await tx.timelineEvent.create({
          data: {
            userId: input.userId,
            type: TimelineEventType.MEAL,
            sourceKind: TimelineSourceKind.MEAL,
            sourceId: input.mealId,
            startAt: input.loggedAt,
            endAt: input.loggedAt,
            confidence: new Prisma.Decimal(input.aggregate.confidence),
            payload: {
              mealId: input.mealId,
              title: input.aggregate.title,
              calories: input.aggregate.totals.calories,
              carbohydrates: input.aggregate.totals.carbohydrates,
              protein: input.aggregate.totals.protein,
              fat: input.aggregate.totals.fat,
              xe: input.aggregate.totals.xe,
              gi: input.aggregate.totals.gi,
              gl: input.aggregate.totals.gl,
              recommendations: input.aggregate.recommendations,
            },
          },
        });
      },
    );
  }

  async failMealAnalysis(
    mealId: string,
    documentIds: string[],
    reason: string,
    aiDispatchFailed = false,
  ) {
    await this.prismaService.$transaction([
      this.prismaService.meal.update({
        where: { id: mealId },
        data: {
          status: MealStatus.FAILED,
          failureReason: reason,
          aiDispatchStatus: aiDispatchFailed
            ? MealAiDispatchStatus.FAILED
            : undefined,
          aiDispatchFailedAt: aiDispatchFailed ? new Date() : undefined,
          aiDispatchFailureReason: aiDispatchFailed ? reason : undefined,
        },
      }),
      this.prismaService.document.updateMany({
        where: {
          id: {
            in: documentIds,
          },
        },
        data: {
          status: DocumentStatus.FAILED,
          failedAt: new Date(),
          failureReason: reason,
        },
      }),
    ]);
  }

  getStatus(userId: string, mealId: string) {
    return this.prismaService.meal.findFirstOrThrow({
      where: {
        id: mealId,
        userId,
      },
      select: {
        id: true,
        status: true,
        aiDispatchStatus: true,
        aiDispatchedAt: true,
        aiDispatchFailedAt: true,
        aiDispatchFailureReason: true,
        failureReason: true,
        title: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
