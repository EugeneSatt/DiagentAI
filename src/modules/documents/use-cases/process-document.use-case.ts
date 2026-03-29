import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import {
  AI_JOB_NAMES,
  AI_PROCESSING_QUEUE,
} from '../../../core/queue/queue.constants';
import { DocumentStatus } from '../../../domain/common/enums/domain.enums';
import { DoctorNoteExtractionResult } from '../../../domain/documents/doctor-note-extraction.interface';
import { LabDocumentExtractionResult } from '../../../domain/labs/lab-extraction.interface';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { EncryptionService } from '../../../infrastructure/crypto/encryption.service';
import { toInputJsonValue } from '../../../shared/utils/json.util';
import { AiService } from '../../ai/services/ai.service';
import { PersistLabResultsUseCase } from '../../labs/use-cases/persist-lab-results.use-case';
import { DocumentsRepository } from '../repositories/documents.repository';
import { PersistDoctorNoteUseCase } from './persist-doctor-note.use-case';

@Injectable()
export class ProcessDocumentUseCase {
  private readonly logger = new Logger(ProcessDocumentUseCase.name);

  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly aiService: AiService,
    private readonly persistLabResultsUseCase: PersistLabResultsUseCase,
    private readonly persistDoctorNoteUseCase: PersistDoctorNoteUseCase,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @InjectQueue(AI_PROCESSING_QUEUE)
    private readonly aiQueue: Queue,
  ) {}

  async execute(documentId: string): Promise<void> {
    const document = await this.documentsRepository.findById(documentId);

    this.logger.log(
      JSON.stringify({
        event: 'documents.process.started',
        documentId: document.id,
        userId: document.userId,
        mimeType: document.mimeType,
        cloudinaryUrl: document.cloudinaryUrl,
      }),
    );

    await this.documentsRepository.update(document.id, {
      status: DocumentStatus.PROCESSING,
      processedAt: new Date(),
      failedAt: null,
      failureReason: null,
    });

    try {
      this.logger.log(
        JSON.stringify({
          event: 'documents.ai.request.started',
          documentId: document.id,
          userId: document.userId,
          mimeType: document.mimeType,
          type: document.type,
        }),
      );

      await this.documentsRepository.update(document.id, {
        status: DocumentStatus.OCR_COMPLETED,
      });

      if (document.type === 'LAB_REPORT') {
        const extraction = await this.aiService.extractLabsFromDocument({
          documentUrl: document.cloudinaryUrl,
          mimeType: document.mimeType,
        });
        this.logger.log(
          JSON.stringify({
            event: 'documents.ai.request.completed',
            documentId: document.id,
            userId: document.userId,
            type: document.type,
            extractedItems: extraction.items.length,
            rawTextLength: extraction.rawText.length,
          }),
        );

        await this.persistLabExtraction(
          document.userId,
          document.id,
          extraction,
        );
      } else if (this.isDoctorNoteType(document.type)) {
        const extraction = await this.aiService.extractDoctorNoteFromDocument({
          documentUrl: document.cloudinaryUrl,
          mimeType: document.mimeType,
        });
        this.logger.log(
          JSON.stringify({
            event: 'documents.ai.request.completed',
            documentId: document.id,
            userId: document.userId,
            type: document.type,
            title: extraction.title,
            diagnosesCount: extraction.diagnoses.length,
            recommendationsCount: extraction.recommendations.length,
          }),
        );

        await this.persistDoctorNoteExtraction(
          document.userId,
          document.id,
          extraction,
        );
      } else {
        const rawText = await this.aiService.extractDocumentText({
          documentUrl: document.cloudinaryUrl,
          mimeType: document.mimeType,
        });
        this.logger.log(
          JSON.stringify({
            event: 'documents.ai.request.completed',
            documentId: document.id,
            userId: document.userId,
            type: document.type,
            rawTextLength: rawText.length,
          }),
        );

        await this.persistRawOnly(document.id, rawText);
      }

      await this.documentsRepository.update(document.id, {
        status: DocumentStatus.COMPLETED,
        extractedAt: new Date(),
      });

      try {
        await this.aiQueue.add(AI_JOB_NAMES.GENERATE_INSIGHTS, {
          userId: document.userId,
          trigger: 'document-processed',
        });
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: 'documents.insights.enqueue.failed',
            documentId: document.id,
            userId: document.userId,
            message:
              error instanceof Error
                ? error.message
                : 'Failed to enqueue document insights',
          }),
        );
      }

      await this.auditService.record({
        userId: document.userId,
        action: 'documents.processed',
        entityType: 'document',
        entityId: document.id,
        metadata: {
          documentType: document.type,
        },
      });
      this.logger.log(
        JSON.stringify({
          event: 'documents.process.completed',
          documentId: document.id,
          userId: document.userId,
          documentType: document.type,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown processing error';

      this.logger.error(
        JSON.stringify({
          event: 'documents.process.failed',
          documentId: document.id,
          userId: document.userId,
          message,
        }),
        error instanceof Error ? error.stack : undefined,
      );
      await this.documentsRepository.update(document.id, {
        status: DocumentStatus.FAILED,
        failedAt: new Date(),
        failureReason: message,
      });
      await this.auditService.record({
        userId: document.userId,
        action: 'documents.failed',
        entityType: 'document',
        entityId: document.id,
        metadata: {
          reason: message,
        },
      });
      throw error;
    }
  }

  private async persistLabExtraction(
    userId: string,
    documentId: string,
    extraction: LabDocumentExtractionResult,
  ): Promise<void> {
    await this.documentsRepository.upsertRawDocument(documentId, {
      documentId,
      rawTextEncrypted: this.encryptionService.encrypt(extraction.rawText),
      normalizedJson: toInputJsonValue(extraction),
      aiResponseEncrypted: this.encryptionService.encrypt(
        JSON.stringify(extraction),
      ),
      schemaVersion: 'v1',
      ocrProvider:
        extraction.rawText === '' ? 'unknown' : 'pdf-parse-or-comet-vision',
      model: this.configService.get<string>('comet.textModel'),
    });

    await this.documentsRepository.update(documentId, {
      status: DocumentStatus.EXTRACTED,
    });

    await this.persistLabResultsUseCase.execute(userId, documentId, extraction);
  }

  private async persistDoctorNoteExtraction(
    userId: string,
    documentId: string,
    extraction: DoctorNoteExtractionResult,
  ): Promise<void> {
    await this.documentsRepository.upsertRawDocument(documentId, {
      documentId,
      rawTextEncrypted: this.encryptionService.encrypt(extraction.rawText),
      normalizedJson: toInputJsonValue(extraction),
      aiResponseEncrypted: this.encryptionService.encrypt(
        JSON.stringify(extraction),
      ),
      schemaVersion: 'v1',
      ocrProvider:
        extraction.rawText === '' ? 'unknown' : 'pdf-parse-or-comet-vision',
      model: this.configService.get<string>('comet.textModel'),
    });

    await this.documentsRepository.update(documentId, {
      status: DocumentStatus.EXTRACTED,
    });

    await this.persistDoctorNoteUseCase.execute(userId, documentId, extraction);
  }

  private async persistRawOnly(
    documentId: string,
    rawText: string,
  ): Promise<void> {
    await this.documentsRepository.upsertRawDocument(documentId, {
      documentId,
      rawTextEncrypted: this.encryptionService.encrypt(rawText),
      normalizedJson: toInputJsonValue({
        kind: 'RAW_DOCUMENT_TEXT',
        rawText,
      }),
      aiResponseEncrypted: this.encryptionService.encrypt(
        JSON.stringify({
          rawText,
        }),
      ),
      schemaVersion: 'v1',
      ocrProvider: rawText === '' ? 'unknown' : 'pdf-parse-or-comet-vision',
      model: this.configService.get<string>('comet.textModel'),
    });

    await this.documentsRepository.update(documentId, {
      status: DocumentStatus.EXTRACTED,
    });
  }

  private isDoctorNoteType(documentType: string): boolean {
    return documentType === 'GENERAL' || documentType === 'PRESCRIPTION';
  }
}
