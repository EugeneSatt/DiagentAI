import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LabDocumentExtractionResult } from '../../../domain/labs/lab-extraction.interface';
import { LabsRepository } from '../repositories/labs.repository';

@Injectable()
export class PersistLabResultsUseCase {
  constructor(private readonly labsRepository: LabsRepository) {}

  execute(
    userId: string,
    sourceDocumentId: string,
    extraction: LabDocumentExtractionResult,
  ): Promise<void> {
    return this.labsRepository.createManyWithTimeline(
      userId,
      extraction.items.map((item) => ({
        normalizedName: item.normalizedName,
        rawName: item.name,
        type: item.type,
        value: item.value,
        unit: item.unit,
        referenceRange: item.referenceRange as Prisma.InputJsonValue,
        status: item.status,
        confidence: item.confidence,
        sourceDocumentId,
        measuredAt: new Date(
          item.measuredAt ?? extraction.observedAt ?? new Date().toISOString(),
        ),
      })),
    );
  }
}
