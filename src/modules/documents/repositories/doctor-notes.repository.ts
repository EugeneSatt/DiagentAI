import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  TimelineEventType,
  TimelineSourceKind,
} from '../../../domain/common/enums/domain.enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class DoctorNotesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async upsertFromDocument(input: {
    userId: string;
    sourceDocumentId: string;
    title: string;
    summary: string;
    visitDate?: Date;
    doctorName?: string;
    specialty?: string;
    clinicName?: string;
    diagnoses: Prisma.InputJsonValue;
    complaints: Prisma.InputJsonValue;
    medications: Prisma.InputJsonValue;
    recommendations: Prisma.InputJsonValue;
    followUpActions: Prisma.InputJsonValue;
    nextVisitDate?: Date;
    confidence: number;
  }) {
    const noteDate = input.visitDate ?? new Date();

    return this.prismaService.$transaction(async (tx) => {
      const transaction = tx as unknown as PrismaClient;
      const doctorNote = await transaction.doctorNote.upsert({
        where: {
          sourceDocumentId: input.sourceDocumentId,
        },
        create: {
          userId: input.userId,
          sourceDocumentId: input.sourceDocumentId,
          title: input.title,
          summary: input.summary,
          visitDate: input.visitDate,
          doctorName: input.doctorName,
          specialty: input.specialty,
          clinicName: input.clinicName,
          diagnoses: input.diagnoses,
          complaints: input.complaints,
          medications: input.medications,
          recommendations: input.recommendations,
          followUpActions: input.followUpActions,
          nextVisitDate: input.nextVisitDate,
          confidence: new Prisma.Decimal(input.confidence),
        },
        update: {
          title: input.title,
          summary: input.summary,
          visitDate: input.visitDate,
          doctorName: input.doctorName,
          specialty: input.specialty,
          clinicName: input.clinicName,
          diagnoses: input.diagnoses,
          complaints: input.complaints,
          medications: input.medications,
          recommendations: input.recommendations,
          followUpActions: input.followUpActions,
          nextVisitDate: input.nextVisitDate,
          confidence: new Prisma.Decimal(input.confidence),
        },
      });

      await transaction.timelineEvent.deleteMany({
        where: {
          userId: input.userId,
          type: TimelineEventType.NOTE,
          sourceKind: TimelineSourceKind.AI_EXTRACTION,
          sourceId: doctorNote.id,
        },
      });

      await transaction.timelineEvent.create({
        data: {
          userId: input.userId,
          type: TimelineEventType.NOTE,
          sourceKind: TimelineSourceKind.AI_EXTRACTION,
          sourceId: doctorNote.id,
          startAt: noteDate,
          endAt: input.nextVisitDate ?? noteDate,
          confidence: new Prisma.Decimal(input.confidence),
          payload: {
            doctorNoteId: doctorNote.id,
            sourceDocumentId: input.sourceDocumentId,
            title: input.title,
            summary: input.summary,
            doctorName: input.doctorName ?? null,
            specialty: input.specialty ?? null,
            clinicName: input.clinicName ?? null,
          },
        },
      });

      return doctorNote;
    });
  }

  listByUser(userId: string) {
    const prisma = this.prismaService as unknown as PrismaClient;

    return prisma.doctorNote.findMany({
      where: { userId },
      include: {
        sourceDocument: true,
      },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
