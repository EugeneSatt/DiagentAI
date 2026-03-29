import { Module } from '@nestjs/common';
import { InfrastructureBullModule } from '../../infrastructure/bullmq/bullmq.module';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { LabsModule } from '../labs/labs.module';
import { DocumentsController } from './controllers/documents.controller';
import { DoctorNotesRepository } from './repositories/doctor-notes.repository';
import { DocumentsRepository } from './repositories/documents.repository';
import { DocumentsService } from './services/documents.service';
import { PersistDoctorNoteUseCase } from './use-cases/persist-doctor-note.use-case';
import { ProcessDocumentUseCase } from './use-cases/process-document.use-case';
import { UploadDocumentUseCase } from './use-cases/upload-document.use-case';

@Module({
  imports: [AuthModule, InfrastructureBullModule, AiModule, LabsModule],
  controllers: [DocumentsController],
  providers: [
    DoctorNotesRepository,
    DocumentsRepository,
    DocumentsService,
    PersistDoctorNoteUseCase,
    UploadDocumentUseCase,
    ProcessDocumentUseCase,
  ],
  exports: [DocumentsService, ProcessDocumentUseCase],
})
export class DocumentsModule {}
