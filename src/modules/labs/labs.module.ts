import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { LabsController } from './controllers/labs.controller';
import { LabsRepository } from './repositories/labs.repository';
import { LabsService } from './services/labs.service';
import { PersistLabResultsUseCase } from './use-cases/persist-lab-results.use-case';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [LabsController],
  providers: [LabsRepository, LabsService, PersistLabResultsUseCase],
  exports: [LabsService, LabsRepository, PersistLabResultsUseCase],
})
export class LabsModule {}
