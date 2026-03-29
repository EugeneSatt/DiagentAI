import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { HealthMetricType } from '../../../domain/common/enums/domain.enums';

export class HealthSampleDto {
  @IsEnum(HealthMetricType)
  type!: HealthMetricType;

  @Type(() => Number)
  @IsNumber()
  value!: number;

  @IsString()
  unit!: string;

  @IsDateString()
  sampledAt!: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  sourceApp?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class SyncHealthDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HealthSampleDto)
  samples!: HealthSampleDto[];
}
