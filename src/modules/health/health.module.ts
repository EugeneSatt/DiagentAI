import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HealthController } from './controllers/health.controller';
import { HealthRepository } from './repositories/health.repository';
import { HealthService } from './services/health.service';
import { SyncHealthUseCase } from './use-cases/sync-health.use-case';

@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [HealthRepository, HealthService, SyncHealthUseCase],
  exports: [HealthService],
})
export class HealthModule {}
