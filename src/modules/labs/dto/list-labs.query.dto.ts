import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { LabResultType } from '../../../domain/common/enums/domain.enums';
import { PaginationQueryDto } from '../../../shared/dto/pagination-query.dto';

export class ListLabsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(LabResultType)
  type?: LabResultType;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  from?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  to?: string;
}
