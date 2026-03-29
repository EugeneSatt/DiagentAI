import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InsightsController } from './controllers/insights.controller';
import { InsightsRepository } from './repositories/insights.repository';
import { InsightsService } from './services/insights.service';
import { GenerateInsightsUseCase } from './use-cases/generate-insights.use-case';

@Module({
  imports: [AuthModule],
  controllers: [InsightsController],
  providers: [InsightsRepository, InsightsService, GenerateInsightsUseCase],
  exports: [InsightsService],
})
export class InsightsModule {}
