import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  AI_JOB_NAMES,
  AI_PROCESSING_QUEUE,
} from '../../../core/queue/queue.constants';
import {
  MealAiDispatchStatus,
  MealStatus,
} from '../../../domain/common/enums/domain.enums';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { LocalStagingService } from '../../../infrastructure/storage/local-staging.service';
import { AnalyzeMealUploadDto } from '../dto/analyze-meal-upload.dto';
import { MealsRepository } from '../repositories/meals.repository';

@Injectable()
export class AnalyzeMealUploadUseCase {
  private readonly logger = new Logger(AnalyzeMealUploadUseCase.name);

  constructor(
    private readonly localStagingService: LocalStagingService,
    private readonly mealsRepository: MealsRepository,
    private readonly auditService: AuditService,
    @InjectQueue(AI_PROCESSING_QUEUE)
    private readonly aiQueue: Queue,
  ) {}

  async execute(
    userId: string,
    dto: AnalyzeMealUploadDto,
    files: Express.Multer.File[] | undefined,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one meal image is required');
    }

    if (files.length > 5) {
      throw new BadRequestException('No more than 5 meal images are allowed');
    }

    if (dto.items.length !== files.length) {
      throw new BadRequestException(
        'items array length must match uploaded files length',
      );
    }

    files.forEach((file) => {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Only images are supported for meals');
      }
    });

    this.logger.log(
      JSON.stringify({
        event: 'meals.upload.received',
        userId,
        fileCount: files.length,
        title: dto.title ?? null,
        loggedAt: dto.loggedAt ?? null,
        items: dto.items.map((item, index) => ({
          index,
          hasDescription: Boolean(item.description?.trim()),
          descriptionLength: item.description?.trim().length ?? 0,
        })),
        files: files.map((file, index) => ({
          index,
          fileName: file.originalname,
          mimeType: file.mimetype,
          bytes: file.size,
        })),
      }),
    );

    const stagedItems = await Promise.all(
      files.map(async (file, index) => {
        const tempFilePath = await this.localStagingService.saveBuffer({
          buffer: file.buffer,
          fileName: file.originalname,
          prefix: `${userId}-meal`,
        });

        return {
          fileName: file.originalname,
          mimeType: file.mimetype,
          bytes: file.size,
          imageUrl: tempFilePath,
          publicId: `staging:${randomUUID()}`,
          description: dto.items[index]?.description,
        };
      }),
    );

    const meal = await this.mealsRepository.createPendingAnalysis(
      userId,
      dto,
      stagedItems,
    );

    try {
      await this.aiQueue.add(AI_JOB_NAMES.ANALYZE_MEAL, {
        mealId: meal.id,
      });
      this.logger.log(
        JSON.stringify({
          event: 'meals.upload.queued',
          userId,
          mealId: meal.id,
          imageCount: files.length,
          aiDispatchStatus: MealAiDispatchStatus.PENDING,
        }),
      );
    } catch {
      throw new InternalServerErrorException('Failed to queue meal analysis');
    }

    await this.auditService.record({
      userId,
      action: 'meals.analyze.upload',
      entityType: 'meal',
      entityId: meal.id,
      metadata: {
        imageCount: files.length,
      },
    });

    return {
      id: meal.id,
      status: MealStatus.QUEUED,
      aiDispatchStatus: MealAiDispatchStatus.PENDING,
      dispatchOk: false,
      imageCount: files.length,
    };
  }
}
