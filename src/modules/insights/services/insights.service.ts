import { Injectable } from '@nestjs/common';
import { InsightsRepository } from '../repositories/insights.repository';
import { GenerateInsightsUseCase } from '../use-cases/generate-insights.use-case';

@Injectable()
export class InsightsService {
  constructor(
    private readonly generateInsightsUseCase: GenerateInsightsUseCase,
    private readonly insightsRepository: InsightsRepository,
  ) {}

  generateForUser(userId: string) {
    return this.generateInsightsUseCase.execute(userId);
  }

  listLatest(userId: string) {
    return this.insightsRepository.listLatest(userId);
  }
}
