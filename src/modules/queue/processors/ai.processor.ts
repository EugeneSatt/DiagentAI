import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  AI_JOB_NAMES,
  AI_PROCESSING_QUEUE,
} from '../../../core/queue/queue.constants';
import { AiProcessingJob } from '../../../domain/insights/ai-processing-job.interface';
import { MealAnalysisJob } from '../../../domain/meals/meal-analysis-job.interface';
import { InsightsService } from '../../insights/services/insights.service';
import { MealsService } from '../../meals/services/meals.service';

@Processor(AI_PROCESSING_QUEUE)
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    private readonly insightsService: InsightsService,
    private readonly mealsService: MealsService,
  ) {
    super();
  }

  async process(job: Job<AiProcessingJob | MealAnalysisJob>): Promise<void> {
    this.logger.log(
      JSON.stringify({
        event: 'ai-queue.job.started',
        queue: AI_PROCESSING_QUEUE,
        jobId: job.id,
        jobName: job.name,
        data: job.data,
      }),
    );
    if (job.name === AI_JOB_NAMES.GENERATE_INSIGHTS) {
      await this.insightsService.generateForUser(
        (job.data as AiProcessingJob).userId,
      );
      this.logger.log(
        JSON.stringify({
          event: 'ai-queue.job.completed',
          queue: AI_PROCESSING_QUEUE,
          jobId: job.id,
          jobName: job.name,
        }),
      );
      return;
    }

    if (job.name === AI_JOB_NAMES.ANALYZE_MEAL) {
      await this.mealsService.processAnalysis(
        (job.data as MealAnalysisJob).mealId,
      );
      this.logger.log(
        JSON.stringify({
          event: 'ai-queue.job.completed',
          queue: AI_PROCESSING_QUEUE,
          jobId: job.id,
          jobName: job.name,
        }),
      );
    }
  }
}
