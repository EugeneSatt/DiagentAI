import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../../../domain/auth/jwt-payload.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { GeneratePlanDto } from '../dto/generate-plan.dto';
import { PlansService } from '../services/plans.service';

@Controller({
  path: 'plans',
  version: '1',
})
@UseGuards(AccessTokenGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('fitness/current')
  getCurrentFitnessPlan(@CurrentUser() user: JwtPayload) {
    return this.plansService.getCurrentFitnessPlan(user.sub);
  }

  @Post('fitness/generate')
  generateFitnessPlan(@CurrentUser() user: JwtPayload) {
    return this.plansService.generateFitnessPlan(user.sub);
  }

  @Get('meal/current')
  getCurrentMealPlan(@CurrentUser() user: JwtPayload) {
    return this.plansService.getCurrentMealPlan(user.sub);
  }

  @Post('meal/generate')
  generateMealPlan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GeneratePlanDto,
  ) {
    return this.plansService.generateMealPlan(user.sub, dto);
  }
}
