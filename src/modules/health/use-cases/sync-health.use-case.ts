import { Injectable } from '@nestjs/common';
import { SyncHealthDto } from '../dto/sync-health.dto';
import { HealthRepository } from '../repositories/health.repository';

@Injectable()
export class SyncHealthUseCase {
  constructor(private readonly healthRepository: HealthRepository) {}

  execute(userId: string, dto: SyncHealthDto) {
    return this.healthRepository.sync(userId, dto);
  }
}
