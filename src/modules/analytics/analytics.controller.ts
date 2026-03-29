import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../../domain/auth/jwt-payload.interface';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { AnalyticsService } from './analytics.service';

@Controller({
  path: 'analytics',
  version: '1',
})
@UseGuards(AccessTokenGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getSummary(user.sub);
  }
}
