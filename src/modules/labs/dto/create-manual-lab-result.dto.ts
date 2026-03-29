import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  LabResultStatus,
  LabResultType,
} from '../../../domain/common/enums/domain.enums';

export class CreateManualLabResultDto {
  @IsEnum(LabResultType)
  type!: LabResultType;

  @IsString()
  normalizedName!: string;

  @IsOptional()
  @IsString()
  rawName?: string;

  @Type(() => Number)
  @IsNumber()
  value!: number;

  @IsString()
  unit!: string;

  @IsOptional()
  referenceRange?: {
    low?: number;
    high?: number;
    text?: string;
  };

  @IsEnum(LabResultStatus)
  status!: LabResultStatus;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @IsDateString()
  measuredAt!: string;
}
