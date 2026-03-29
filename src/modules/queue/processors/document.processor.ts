import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  DOCUMENT_JOB_NAMES,
  DOCUMENT_PROCESSING_QUEUE,
} from '../../../core/queue/queue.constants';
import { DocumentProcessingJob } from '../../../domain/documents/document-processing-job.interface';
import { DocumentsService } from '../../documents/services/documents.service';

@Processor(DOCUMENT_PROCESSING_QUEUE)
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(private readonly documentsService: DocumentsService) {
    super();
  }

  async process(job: Job<DocumentProcessingJob>): Promise<void> {
    this.logger.log(
      JSON.stringify({
        event: 'document-queue.job.started',
        queue: DOCUMENT_PROCESSING_QUEUE,
        jobId: job.id,
        jobName: job.name,
        data: job.data,
      }),
    );
    if (job.name !== DOCUMENT_JOB_NAMES.PROCESS_DOCUMENT) {
      return;
    }

    await this.documentsService.process(job.data.documentId);
    this.logger.log(
      JSON.stringify({
        event: 'document-queue.job.completed',
        queue: DOCUMENT_PROCESSING_QUEUE,
        jobId: job.id,
        jobName: job.name,
      }),
    );
  }
}
