import { IsEnum, IsOptional } from 'class-validator';
import {
  DocumentSource,
  DocumentType,
} from '../../../domain/common/enums/domain.enums';

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;

  @IsOptional()
  @IsEnum(DocumentSource)
  source?: DocumentSource;
}
