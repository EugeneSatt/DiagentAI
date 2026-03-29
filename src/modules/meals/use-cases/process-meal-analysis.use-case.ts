import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import {
  AI_JOB_NAMES,
  AI_PROCESSING_QUEUE,
} from '../../../core/queue/queue.constants';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { CloudinaryService } from '../../../infrastructure/cloudinary/cloudinary.service';
import { EncryptionService } from '../../../infrastructure/crypto/encryption.service';
import { LocalStagingService } from '../../../infrastructure/storage/local-staging.service';
import { AiService } from '../../ai/services/ai.service';
import { MealImageAnalysisResult } from '../../../domain/meals/meal-analysis.interface';
import { MealsRepository } from '../repositories/meals.repository';

@Injectable()
export class ProcessMealAnalysisUseCase {
  private readonly logger = new Logger(ProcessMealAnalysisUseCase.name);

  constructor(
    private readonly mealsRepository: MealsRepository,
    private readonly aiService: AiService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly localStagingService: LocalStagingService,
    @InjectQueue(AI_PROCESSING_QUEUE)
    private readonly aiQueue: Queue,
  ) {}

  async execute(mealId: string): Promise<void> {
    const meal = await this.mealsRepository.getMealForAnalysis(mealId);
    this.logger.log(
      JSON.stringify({
        event: 'meals.process.started',
        mealId: meal.id,
        userId: meal.userId,
        componentCount: meal.components.length,
      }),
    );
    const documentIds = meal.components
      .map(
        (component: (typeof meal.components)[number]) =>
          component.sourceDocumentId,
      )
      .filter((value: string | null): value is string => Boolean(value));

    await this.mealsRepository.markAnalysisProcessing(meal.id, documentIds);
    let aiDispatchStarted = false;
    const stagedFilePaths = meal.components
      .map((component) => component.imageUrl)
      .filter((value) => this.isLocalStagingPath(value));

    try {
      const analyses = [];

      for (const component of meal.components) {
        const imageUrl = await this.ensureRemoteImageUrl(meal, component);

        if (!aiDispatchStarted) {
          await this.mealsRepository.markAiDispatchStarted(meal.id);
          aiDispatchStarted = true;
          this.logger.log(
            JSON.stringify({
              event: 'meals.ai.dispatch.started',
              mealId: meal.id,
              userId: meal.userId,
              componentCount: meal.components.length,
            }),
          );
        }

        this.logger.log(
          JSON.stringify({
            event: 'meals.ai.image.started',
            mealId: meal.id,
            userId: meal.userId,
            componentId: component.id,
            hasDescription: Boolean(component.description?.trim()),
            imageUrl,
          }),
        );
        const analysis = await this.analyzeComponent(meal, component, imageUrl);
        this.logger.log(
          JSON.stringify({
            event: 'meals.ai.image.completed',
            mealId: meal.id,
            userId: meal.userId,
            componentId: component.id,
            title: analysis.title,
            confidence: analysis.confidence,
            detectedItems: analysis.detectedItems.length,
          }),
        );

        analyses.push(analysis);
        await this.mealsRepository.saveComponentAnalysis({
          componentId: component.id,
          sourceDocumentId: component.sourceDocumentId,
          analysis,
          aiResponseEncrypted: this.encryptionService.encrypt(
            JSON.stringify(analysis),
          ),
          model: this.configService.get<string>('comet.visionModel'),
        });
      }

      this.logger.log(
        JSON.stringify({
          event: 'meals.ai.aggregate.started',
          mealId: meal.id,
          userId: meal.userId,
          analysesCount: analyses.length,
        }),
      );
      const aggregate = await this.aiService.summarizeMealAnalyses(analyses);
      this.logger.log(
        JSON.stringify({
          event: 'meals.ai.aggregate.completed',
          mealId: meal.id,
          userId: meal.userId,
          confidence: aggregate.confidence,
          title: aggregate.title,
        }),
      );

      await this.mealsRepository.completeMealAnalysis({
        mealId: meal.id,
        userId: meal.userId,
        aggregate,
        loggedAt: meal.loggedAt,
      });

      try {
        await this.aiQueue.add(AI_JOB_NAMES.GENERATE_INSIGHTS, {
          userId: meal.userId,
          trigger: 'meal-analyzed',
        });
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: 'meals.insights.enqueue.failed',
            mealId: meal.id,
            userId: meal.userId,
            message:
              error instanceof Error
                ? error.message
                : 'Failed to enqueue meal insights',
          }),
        );
      }

      await this.auditService.record({
        userId: meal.userId,
        action: 'meals.analyze.completed',
        entityType: 'meal',
        entityId: meal.id,
        metadata: {
          componentCount: meal.components.length,
        },
      });
      this.logger.log(
        JSON.stringify({
          event: 'meals.process.completed',
          mealId: meal.id,
          userId: meal.userId,
          componentCount: meal.components.length,
        }),
      );

      for (const filePath of stagedFilePaths) {
        await this.localStagingService.delete(filePath);
      }
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Meal analysis failed';

      this.logger.error(
        JSON.stringify({
          event: 'meals.process.failed',
          mealId: meal.id,
          userId: meal.userId,
          aiDispatchStarted,
          message: reason,
        }),
        error instanceof Error ? error.stack : undefined,
      );
      await this.mealsRepository.failMealAnalysis(
        meal.id,
        documentIds,
        reason,
        !aiDispatchStarted,
      );
      await this.auditService.record({
        userId: meal.userId,
        action: 'meals.analyze.failed',
        entityType: 'meal',
        entityId: meal.id,
        metadata: {
          reason,
        },
      });

      for (const filePath of stagedFilePaths) {
        await this.localStagingService.delete(filePath);
      }
      throw error;
    }
  }

  private async analyzeComponent(
    meal: Awaited<ReturnType<MealsRepository['getMealForAnalysis']>>,
    component: Awaited<
      ReturnType<MealsRepository['getMealForAnalysis']>
    >['components'][number],
    imageUrl: string | null,
  ): Promise<MealImageAnalysisResult> {
    const description = component.description?.trim();

    if (!imageUrl) {
      if (description) {
        this.logger.warn(
          JSON.stringify({
            event: 'meals.ai.image.unavailable-fallback.started',
            mealId: meal.id,
            userId: meal.userId,
            componentId: component.id,
            reason: 'image-unavailable',
          }),
        );

        return this.aiService.analyzeMealFromDescription(description);
      }

      return this.buildUnavailableAnalysis(component.description);
    }

    try {
      const imageAnalysis = await this.aiService.analyzeMealImage({
        imageUrl,
        description: component.description ?? undefined,
      });

      if (
        this.shouldFallbackToDescription(imageAnalysis, component.description)
      ) {
        this.logger.warn(
          JSON.stringify({
            event: 'meals.ai.image.fallback-to-description',
            mealId: meal.id,
            userId: meal.userId,
            componentId: component.id,
            reason: 'image-analysis-empty',
          }),
        );

        return this.aiService.analyzeMealFromDescription(
          component.description!.trim(),
        );
      }

      return imageAnalysis;
    } catch (error) {
      if (description) {
        this.logger.warn(
          JSON.stringify({
            event: 'meals.ai.image.failed-fallback.started',
            mealId: meal.id,
            userId: meal.userId,
            componentId: component.id,
            message:
              error instanceof Error
                ? error.message
                : 'Meal image analysis failed',
          }),
        );

        return this.aiService.analyzeMealFromDescription(description);
      }

      this.logger.warn(
        JSON.stringify({
          event: 'meals.ai.image.failed-fallback.unavailable',
          mealId: meal.id,
          userId: meal.userId,
          componentId: component.id,
          message:
            error instanceof Error
              ? error.message
              : 'Meal image analysis failed',
        }),
      );

      return this.buildUnavailableAnalysis(component.description);
    }
  }

  private async ensureRemoteImageUrl(
    meal: Awaited<ReturnType<MealsRepository['getMealForAnalysis']>>,
    component: Awaited<
      ReturnType<MealsRepository['getMealForAnalysis']>
    >['components'][number],
  ): Promise<string | null> {
    if (!this.isLocalStagingPath(component.imageUrl)) {
      return component.imageUrl;
    }

    this.logger.log(
      JSON.stringify({
        event: 'meals.cloudinary.promote.started',
        mealId: meal.id,
        userId: meal.userId,
        componentId: component.id,
        filePath: component.imageUrl,
      }),
    );

    try {
      const fileBuffer = await this.localStagingService.readBuffer(
        component.imageUrl,
      );
      const upload = await this.cloudinaryService.uploadBuffer(
        fileBuffer,
        `${meal.userId}-meal-${component.id}`,
      );

      await this.mealsRepository.attachUploadedMealAsset({
        mealId: meal.id,
        componentId: component.id,
        sourceDocumentId: component.sourceDocumentId,
        imageUrl: upload.url,
        publicId: upload.publicId,
        bytes: upload.bytes,
        ordinal: component.ordinal,
      });

      this.logger.log(
        JSON.stringify({
          event: 'meals.cloudinary.promote.completed',
          mealId: meal.id,
          userId: meal.userId,
          componentId: component.id,
          imageUrl: upload.url,
          publicId: upload.publicId,
        }),
      );

      return upload.url;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to promote local meal asset';

      this.logger.warn(
        JSON.stringify({
          event: 'meals.cloudinary.promote.failed',
          mealId: meal.id,
          userId: meal.userId,
          componentId: component.id,
          filePath: component.imageUrl,
          message,
          hasDescription: Boolean(component.description?.trim()),
        }),
      );

      return null;
    }
  }

  private shouldFallbackToDescription(
    analysis: MealImageAnalysisResult,
    description?: string | null,
  ) {
    if (!description?.trim()) {
      return false;
    }

    if (analysis.detectedItems.length > 0) {
      return false;
    }

    return (
      analysis.totals.calories === 0 &&
      analysis.totals.protein === 0 &&
      analysis.totals.fat === 0 &&
      analysis.totals.carbohydrates === 0 &&
      analysis.totals.xe === 0 &&
      analysis.totals.gi === 0 &&
      analysis.totals.gl === 0
    );
  }

  private buildUnavailableAnalysis(
    description?: string | null,
  ): MealImageAnalysisResult {
    const resolvedDescription = description?.trim();
    const title = resolvedDescription
      ? `Не удалось уверенно оценить: ${resolvedDescription}`
      : 'Не удалось распознать блюдо';

    return {
      title,
      summary: resolvedDescription
        ? `Фото не дало надёжного результата, а описание "${resolvedDescription}" оказалось недостаточным для уверенной оценки.`
        : 'Фото не дало надёжного результата, и без описания нельзя оценить блюдо.',
      confidence: 0,
      detectedItems: [],
      totals: {
        calories: 0,
        protein: 0,
        fat: 0,
        carbohydrates: 0,
        fiber: null,
        xe: 0,
        gi: 0,
        gl: 0,
      },
      recommendations: [
        'Повтори фото при хорошем освещении и держи блюдо целиком в кадре.',
        'Добавь точное описание блюда и порцию в граммах, если фото неинформативно.',
      ],
    };
  }

  private isLocalStagingPath(value: string): boolean {
    return !/^https?:\/\//i.test(value);
  }
}
