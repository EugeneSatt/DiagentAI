import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { PlansController } from './controllers/plans.controller';
import { PlansRepository } from './repositories/plans.repository';
import { PlansService } from './services/plans.service';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [PlansController],
  providers: [PlansRepository, PlansService],
  exports: [PlansService],
})
export class PlansModule {}
