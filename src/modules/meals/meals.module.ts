import { Module } from '@nestjs/common';
import { InfrastructureBullModule } from '../../infrastructure/bullmq/bullmq.module';
import { CloudinaryModule } from '../../infrastructure/cloudinary/cloudinary.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { LocalStagingService } from '../../infrastructure/storage/local-staging.service';
import { MealsController } from './controllers/meals.controller';
import { MealsRepository } from './repositories/meals.repository';
import { MealsService } from './services/meals.service';
import { AnalyzeMealUploadUseCase } from './use-cases/analyze-meal-upload.use-case';
import { CreateMealUseCase } from './use-cases/create-meal.use-case';
import { ProcessMealAnalysisUseCase } from './use-cases/process-meal-analysis.use-case';

@Module({
  imports: [AuthModule, InfrastructureBullModule, AiModule, CloudinaryModule],
  controllers: [MealsController],
  providers: [
    MealsRepository,
    MealsService,
    LocalStagingService,
    CreateMealUseCase,
    AnalyzeMealUploadUseCase,
    ProcessMealAnalysisUseCase,
  ],
  exports: [MealsService, MealsRepository],
})
export class MealsModule {}
