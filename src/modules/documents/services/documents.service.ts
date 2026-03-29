import { Injectable } from '@nestjs/common';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { DoctorNotesRepository } from '../repositories/doctor-notes.repository';
import { DocumentsRepository } from '../repositories/documents.repository';
import { ProcessDocumentUseCase } from '../use-cases/process-document.use-case';
import { UploadDocumentUseCase } from '../use-cases/upload-document.use-case';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly uploadDocumentUseCase: UploadDocumentUseCase,
    private readonly processDocumentUseCase: ProcessDocumentUseCase,
    private readonly documentsRepository: DocumentsRepository,
    private readonly doctorNotesRepository: DoctorNotesRepository,
  ) {}

  upload(
    userId: string,
    dto: UploadDocumentDto,
    file: Express.Multer.File | undefined,
  ) {
    return this.uploadDocumentUseCase.execute(userId, dto, file);
  }

  list(userId: string) {
    return this.documentsRepository.listByUser(userId);
  }

  listDoctorNotes(userId: string) {
    return this.doctorNotesRepository.listByUser(userId);
  }

  process(documentId: string) {
    return this.processDocumentUseCase.execute(documentId);
  }
}
