import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

function parseItems(value: unknown): unknown {
  const parsed =
    typeof value === 'string' ? (JSON.parse(value) as unknown) : value;

  if (Array.isArray(parsed)) {
    return plainToInstance(MealAnalysisItemDto, parsed);
  }

  if (typeof value === 'string') {
    return parsed;
  }

  return value;
}

export class MealAnalysisItemDto {
  @IsOptional()
  @IsString()
  description?: string;
}

export class AnalyzeMealUploadDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  loggedAt?: string;

  @Transform(({ value }) => parseItems(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MealAnalysisItemDto)
  items!: MealAnalysisItemDto[];
}
