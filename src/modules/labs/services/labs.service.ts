import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../../ai/services/ai.service';
import { CreateManualLabResultDto } from '../dto/create-manual-lab-result.dto';
import { ListLabsQueryDto } from '../dto/list-labs.query.dto';
import { LabsRepository } from '../repositories/labs.repository';

@Injectable()
export class LabsService {
  constructor(
    private readonly labsRepository: LabsRepository,
    private readonly aiService: AiService,
  ) {}

  list(userId: string, query: ListLabsQueryDto) {
    return this.labsRepository.listByUser(userId, query);
  }

  createManual(userId: string, dto: CreateManualLabResultDto) {
    return this.labsRepository.createManual(userId, dto);
  }

  latest(userId: string, limit: number) {
    return this.labsRepository.latestByUser(userId, limit);
  }

  async overview(userId: string) {
    const context = await this.labsRepository.getOverviewContext(userId);
    const grouped = new Map<string, typeof context.labs>();

    for (const lab of context.labs) {
      const dateKey = lab.measuredAt.toISOString().slice(0, 10);
      const existing = grouped.get(dateKey) ?? [];
      existing.push(lab);
      grouped.set(dateKey, existing);
    }

    const groupedByDate = [...grouped.entries()].map(([date, items]) => ({
      date,
      items: items.map((lab) => ({
        id: lab.id,
        title: lab.normalizedName,
        type: lab.type,
        value: Number(lab.value),
        unit: lab.unit,
        status: lab.status,
        measuredAt: lab.measuredAt,
      })),
    }));

    const highlights = context.labs.slice(0, 6).map((lab) => ({
      id: lab.id,
      title: lab.normalizedName,
      type: lab.type,
      value: Number(lab.value),
      unit: lab.unit,
      status: lab.status,
      measuredAt: lab.measuredAt,
    }));

    const profileText = this.buildProfileText(context.profile);
    const labsText = JSON.stringify(highlights, null, 2);
    const summary =
      highlights.length > 0
        ? await this.aiService.summarizeLabs({
            profile: profileText,
            labs: labsText,
          })
        : 'Пока нет загруженных анализов. Добавь фото или PDF, и я соберу короткую сводку по показателям.';

    return {
      summary,
      pendingDocuments: context.documents.filter((document) =>
        ['UPLOADED', 'QUEUED', 'PROCESSING'].includes(document.status),
      ).length,
      documents: context.documents.map((document) => ({
        id: document.id,
        fileName: document.fileName,
        uploadedAt: document.uploadedAt,
        status: document.status,
        type: document.type,
      })),
      highlights,
      groupedByDate,
    };
  }

  private buildProfileText(profile: Prisma.JsonValue | null): string {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return 'Профиль пользователя заполнен минимально.';
    }

    const value = profile as Record<string, unknown>;
    const diabetesType =
      typeof value.diabetesType === 'string' ? value.diabetesType : null;
    const goal = typeof value.goal === 'string' ? value.goal : null;
    const about = typeof value.about === 'string' ? value.about : null;

    return [
      diabetesType ? `Тип диабета: ${diabetesType}` : null,
      goal ? `Цель: ${goal}` : null,
      about ? `Описание: ${about}` : null,
    ]
      .filter(Boolean)
      .join('; ');
  }
}
