import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../../../domain/auth/jwt-payload.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { CreateManualLabResultDto } from '../dto/create-manual-lab-result.dto';
import { ListLabsQueryDto } from '../dto/list-labs.query.dto';
import { LabsService } from '../services/labs.service';

@Controller({
  path: 'labs',
  version: '1',
})
@UseGuards(AccessTokenGuard)
export class LabsController {
  constructor(private readonly labsService: LabsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListLabsQueryDto) {
    return this.labsService.list(user.sub, query);
  }

  @Get('overview')
  overview(@CurrentUser() user: JwtPayload) {
    return this.labsService.overview(user.sub);
  }

  @Post('manual')
  createManual(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateManualLabResultDto,
  ) {
    return this.labsService.createManual(user.sub, dto);
  }
}
