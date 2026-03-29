import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../../../domain/auth/jwt-payload.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { SyncHealthDto } from '../dto/sync-health.dto';
import { HealthService } from '../services/health.service';

@Controller({
  path: 'health',
  version: '1',
})
@UseGuards(AccessTokenGuard)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Post('sync')
  sync(@CurrentUser() user: JwtPayload, @Body() dto: SyncHealthDto) {
    return this.healthService.sync(user.sub, dto);
  }
}
