import { Module } from '@nestjs/common';
import { InfrastructureBullModule } from '../../infrastructure/bullmq/bullmq.module';
import { DocumentsModule } from '../documents/documents.module';
import { InsightsModule } from '../insights/insights.module';
import { MealsModule } from '../meals/meals.module';
import { AiProcessor } from './processors/ai.processor';
import { DocumentProcessor } from './processors/document.processor';

@Module({
  imports: [
    InfrastructureBullModule,
    DocumentsModule,
    InsightsModule,
    MealsModule,
  ],
  providers: [DocumentProcessor, AiProcessor],
})
export class QueueModule {}
