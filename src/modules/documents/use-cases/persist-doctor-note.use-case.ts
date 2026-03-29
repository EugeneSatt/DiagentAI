import { Injectable } from '@nestjs/common';
import { DoctorNoteExtractionResult } from '../../../domain/documents/doctor-note-extraction.interface';
import { toInputJsonValue } from '../../../shared/utils/json.util';
import { DoctorNotesRepository } from '../repositories/doctor-notes.repository';

@Injectable()
export class PersistDoctorNoteUseCase {
  constructor(private readonly doctorNotesRepository: DoctorNotesRepository) {}

  execute(
    userId: string,
    sourceDocumentId: string,
    extraction: DoctorNoteExtractionResult,
  ) {
    return this.doctorNotesRepository.upsertFromDocument({
      userId,
      sourceDocumentId,
      title: extraction.title,
      summary: extraction.summary,
      visitDate: this.parseOptionalDate(extraction.visitDate),
      doctorName: this.optionalText(extraction.doctorName),
      specialty: this.optionalText(extraction.specialty),
      clinicName: this.optionalText(extraction.clinicName),
      diagnoses: toInputJsonValue(extraction.diagnoses),
      complaints: toInputJsonValue(extraction.complaints),
      medications: toInputJsonValue(extraction.medications),
      recommendations: toInputJsonValue(extraction.recommendations),
      followUpActions: toInputJsonValue(extraction.followUpActions),
      nextVisitDate: this.parseOptionalDate(extraction.nextVisitDate),
      confidence: extraction.confidence,
    });
  }

  private parseOptionalDate(value?: string): Date | undefined {
    const normalized = value?.trim();

    if (!normalized) {
      return undefined;
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private optionalText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }
}
