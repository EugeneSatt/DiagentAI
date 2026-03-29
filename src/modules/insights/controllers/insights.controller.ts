import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../../../domain/auth/jwt-payload.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { InsightsService } from '../services/insights.service';

@Controller({
  path: 'insights',
  version: '1',
})
@UseGuards(AccessTokenGuard)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.insightsService.listLatest(user.sub);
  }

  @Post('recompute')
  async recompute(@CurrentUser() user: JwtPayload) {
    await this.insightsService.generateForUser(user.sub);
    return this.insightsService.listLatest(user.sub);
  }
}
