import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  DOCUMENT_JOB_NAMES,
  DOCUMENT_PROCESSING_QUEUE,
} from '../../../core/queue/queue.constants';
import { DocumentStatus } from '../../../domain/common/enums/domain.enums';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { CloudinaryService } from '../../../infrastructure/cloudinary/cloudinary.service';
import { DocumentsRepository } from '../repositories/documents.repository';
import { UploadDocumentDto } from '../dto/upload-document.dto';

@Injectable()
export class UploadDocumentUseCase {
  private readonly logger = new Logger(UploadDocumentUseCase.name);

  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly documentsRepository: DocumentsRepository,
    private readonly auditService: AuditService,
    @InjectQueue(DOCUMENT_PROCESSING_QUEUE)
    private readonly documentQueue: Queue,
  ) {}

  async execute(
    userId: string,
    dto: UploadDocumentDto,
    file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const supported =
      file.mimetype.startsWith('image/') || file.mimetype.includes('pdf');

    if (!supported) {
      throw new BadRequestException(
        'Only images and PDF documents are supported',
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'documents.upload.received',
        userId,
        type: dto.type,
        source: dto.source ?? 'FILE_UPLOAD',
        fileName: file.originalname,
        mimeType: file.mimetype,
        bytes: file.size,
      }),
    );

    const upload = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      `${userId}-${randomUUID()}`,
    );

    const document = await this.documentsRepository.create({
      user: {
        connect: {
          id: userId,
        },
      },
      type: dto.type,
      source: dto.source ?? 'FILE_UPLOAD',
      status: DocumentStatus.UPLOADED,
      fileName: file.originalname,
      mimeType: file.mimetype,
      bytes: upload.bytes,
      cloudinaryUrl: upload.url,
      cloudinaryPublicId: upload.publicId,
      metadata: {
        format: upload.format,
        resourceType: upload.resourceType,
      },
    });

    try {
      await this.documentQueue.add(DOCUMENT_JOB_NAMES.PROCESS_DOCUMENT, {
        documentId: document.id,
      });
      this.logger.log(
        JSON.stringify({
          event: 'documents.upload.queued',
          userId,
          documentId: document.id,
          status: DocumentStatus.QUEUED,
        }),
      );
    } catch {
      throw new InternalServerErrorException('Failed to queue document');
    }

    await this.documentsRepository.update(document.id, {
      status: DocumentStatus.QUEUED,
    });

    await this.auditService.record({
      userId,
      action: 'documents.upload',
      entityType: 'document',
      entityId: document.id,
      metadata: {
        type: dto.type,
        mimeType: file.mimetype,
      },
    });

    return {
      id: document.id,
      status: DocumentStatus.QUEUED,
      url: upload.url,
    };
  }
}
