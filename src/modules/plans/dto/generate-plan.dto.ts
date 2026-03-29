import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GeneratePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  preferences?: string;
}
