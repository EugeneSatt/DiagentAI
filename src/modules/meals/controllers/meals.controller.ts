import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtPayload } from '../../../domain/auth/jwt-payload.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { AnalyzeMealUploadDto } from '../dto/analyze-meal-upload.dto';
import { CreateMealDto } from '../dto/create-meal.dto';
import { MealsService } from '../services/meals.service';

@Controller({
  path: 'meals',
  version: '1',
})
@UseGuards(AccessTokenGuard)
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Post('analyze')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: {
        fileSize: 12 * 1024 * 1024,
      },
    }),
  )
  analyze(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AnalyzeMealUploadDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.mealsService.analyzeUpload(user.sub, dto, files);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMealDto) {
    return this.mealsService.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.mealsService.list(user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: JwtPayload, @Param('id') mealId: string) {
    return this.mealsService.detail(user.sub, mealId);
  }

  @Get(':id/status')
  status(@CurrentUser() user: JwtPayload, @Param('id') mealId: string) {
    return this.mealsService.status(user.sub, mealId);
  }
}
