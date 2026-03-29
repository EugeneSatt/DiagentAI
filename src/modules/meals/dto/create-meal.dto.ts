import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class CreateMealDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @IsDateString()
  loggedAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  calories?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  carbohydrates?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  protein?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
