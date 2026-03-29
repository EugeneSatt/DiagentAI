import { Injectable } from '@nestjs/common';
import { SyncHealthDto } from '../dto/sync-health.dto';
import { SyncHealthUseCase } from '../use-cases/sync-health.use-case';

@Injectable()
export class HealthService {
  constructor(private readonly syncHealthUseCase: SyncHealthUseCase) {}

  sync(userId: string, dto: SyncHealthDto) {
    return this.syncHealthUseCase.execute(userId, dto);
  }
}
