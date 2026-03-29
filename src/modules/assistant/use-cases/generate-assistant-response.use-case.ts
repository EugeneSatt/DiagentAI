import { Injectable, Logger } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { EncryptionService } from '../../../infrastructure/crypto/encryption.service';
import { AiService } from '../../ai/services/ai.service';
import {
  AssistantMessageDto,
  AssistantRole,
} from '../dto/assistant-message.dto';
import {
  AssistantContextScope,
  AssistantRepository,
} from '../repositories/assistant.repository';

@Injectable()
export class GenerateAssistantResponseUseCase {
  private readonly logger = new Logger(GenerateAssistantResponseUseCase.name);

  constructor(
    private readonly assistantRepository: AssistantRepository,
    private readonly aiService: AiService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
  ) {}

  async execute(userId: string, dto: AssistantMessageDto) {
    const assistantRole = dto.assistantRole ?? 'endocrinologist';
    const conversation = await this.assistantRepository.ensureConversation(
      userId,
      dto.conversationId,
    );
    const contextScope = this.inferContextScope(dto.message, assistantRole);
    const recentMessages =
      await this.assistantRepository.getConversationMessages(
        userId,
        conversation.id,
        5,
      );
    const structuredContext = await this.buildStructuredContext(
      userId,
      contextScope,
    );
    const structuredContextJson =
      structuredContext as unknown as Prisma.InputJsonValue;

    this.logger.log(
      JSON.stringify({
        event: 'assistant.message.started',
        userId,
        conversationId: conversation.id,
        historyCount: recentMessages.length,
        contextScope,
        assistantRole,
      }),
    );

    await this.assistantRepository.setConversationTitleIfEmpty(
      conversation.id,
      this.buildConversationTitle(dto.message, assistantRole),
    );

    await this.assistantRepository.saveMessage({
      conversationId: conversation.id,
      userId,
      role: MessageRole.USER,
      contentEncrypted: this.encryptionService.encrypt(dto.message),
      structuredContext: structuredContextJson,
      citations: [] as Prisma.InputJsonValue,
    });

    const historyContext = recentMessages
      .slice()
      .reverse()
      .map((message) => ({
        role: message.role === MessageRole.ASSISTANT ? 'assistant' : 'user',
        content: this.encryptionService.decrypt(message.contentEncrypted),
      })) as Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;

    const answer = await this.aiService.createAssistantAnswer({
      systemPrompt: [
        this.buildRoleSystemPrompt(assistantRole),
        'Отвечай только на русском языке.',
        'Используй только историю диалога и структурированный контекст из БД, который тебе передали.',
        'Если данных недостаточно, скажи это прямо и предложи, что именно нужно уточнить.',
        'Не ставь диагнозы и не придумывай измерения, которых нет в контексте.',
        'Если вопрос про риски или отклонения, мягко советуй обсудить это с врачом.',
        'Отвечай коротко, по делу и с опорой на факты из контекста.',
      ].join(' '),
      userPrompt: [
        `Актуальный контекст из БД:\n${JSON.stringify(structuredContext, null, 2)}`,
        `Текущий вопрос пользователя:\n${dto.message}`,
      ].join('\n\n'),
      history: historyContext,
    });

    await this.assistantRepository.saveMessage({
      conversationId: conversation.id,
      userId,
      role: MessageRole.ASSISTANT,
      contentEncrypted: this.encryptionService.encrypt(answer),
      structuredContext: structuredContextJson,
      citations: [] as Prisma.InputJsonValue,
    });

    await this.auditService.record({
      userId,
      action: 'assistant.message',
      entityType: 'assistant_conversation',
      entityId: conversation.id,
      metadata: {
        assistantRole,
        contextScope,
        contextWindow: 5,
      } as unknown as Prisma.InputJsonValue,
    });

    this.logger.log(
      JSON.stringify({
        event: 'assistant.message.completed',
        userId,
        conversationId: conversation.id,
        assistantRole,
      }),
    );

    return {
      conversationId: conversation.id,
      message: answer,
      citations: [],
    };
  }

  private async buildStructuredContext(
    userId: string,
    contextScope: AssistantContextScope,
  ) {
    const context = await this.assistantRepository.getStructuredContext(
      userId,
      contextScope,
    );

    return {
      scope: context.scope,
      labs: context.labs.map((lab: (typeof context.labs)[number]) => ({
        id: lab.id,
        type: lab.type,
        normalizedName: lab.normalizedName,
        value: lab.value.toString(),
        unit: lab.unit,
        status: lab.status,
        measuredAt: lab.measuredAt,
      })),
      meals: context.meals.map((meal: (typeof context.meals)[number]) => ({
        id: meal.id,
        title: meal.title,
        description: meal.description ?? null,
        loggedAt: meal.loggedAt,
        status: meal.status,
        calories: meal.calories?.toString() ?? null,
        carbohydrates: meal.carbohydrates?.toString() ?? null,
        protein: meal.protein?.toString() ?? null,
        fat: meal.fat?.toString() ?? null,
        fiber: meal.fiber?.toString() ?? null,
        xe: meal.xe?.toString() ?? null,
        glycemicIndex: meal.glycemicIndex?.toString() ?? null,
        glycemicLoad: meal.glycemicLoad?.toString() ?? null,
        summary: meal.summary ?? null,
        recommendations: meal.recommendations,
        components: meal.components.map(
          (component: (typeof meal.components)[number]) => ({
            id: component.id,
            ordinal: component.ordinal,
            title: component.title,
            summary: component.summary,
            description: component.description ?? null,
            calories: component.calories?.toString() ?? null,
            carbohydrates: component.carbohydrates?.toString() ?? null,
            protein: component.protein?.toString() ?? null,
            fat: component.fat?.toString() ?? null,
            fiber: component.fiber?.toString() ?? null,
            xe: component.xe?.toString() ?? null,
            gi: component.glycemicIndex?.toString() ?? null,
            gl: component.glycemicLoad?.toString() ?? null,
          }),
        ),
      })),
      healthMetrics: context.healthMetrics.map(
        (metric: (typeof context.healthMetrics)[number]) => ({
          id: metric.id,
          type: metric.type,
          value: metric.value.toString(),
          unit: metric.unit,
          sampledAt: metric.sampledAt,
          startAt: metric.startAt,
          endAt: metric.endAt,
          sourceApp: metric.sourceApp ?? null,
          metadata: metric.metadata,
        }),
      ),
      timeline: context.timeline.map(
        (event: (typeof context.timeline)[number]) => ({
          id: event.id,
          type: event.type,
          startAt: event.startAt,
          endAt: event.endAt,
          sourceKind: event.sourceKind,
          payload: event.payload,
        }),
      ),
      insights: context.insights.map(
        (insight: (typeof context.insights)[number]) => ({
          id: insight.id,
          type: insight.type,
          severity: insight.severity,
          title: insight.title,
          summary: insight.summary,
          generatedAt: insight.generatedAt,
          payload: insight.payload,
        }),
      ),
      doctorNotes: context.doctorNotes.map(
        (note: (typeof context.doctorNotes)[number]) => ({
          id: note.id,
          sourceDocumentId: note.sourceDocumentId,
          title: note.title,
          summary: note.summary,
          visitDate: note.visitDate,
          doctorName: note.doctorName ?? null,
          specialty: note.specialty ?? null,
          clinicName: note.clinicName ?? null,
          diagnoses: note.diagnoses,
          complaints: note.complaints,
          medications: note.medications,
          recommendations: note.recommendations,
          followUpActions: note.followUpActions,
          nextVisitDate: note.nextVisitDate,
          confidence: note.confidence.toString(),
          document: {
            id: note.sourceDocument.id,
            type: note.sourceDocument.type,
            uploadedAt: note.sourceDocument.uploadedAt,
            fileName: note.sourceDocument.fileName,
          },
        }),
      ),
    };
  }

  private inferContextScope(
    message: string,
    assistantRole: AssistantRole,
  ): AssistantContextScope {
    const text = message.toLowerCase();
    const includeGlucose = this.hasAny(text, [
      'сахар',
      'глюкоз',
      'гликеми',
      'hba1c',
      'гликирован',
      'глюкометр',
      'спайк',
      'spike',
    ]);
    const includeMeals = this.hasAny(text, [
      'еда',
      'ел',
      'ела',
      'поел',
      'прием пищи',
      'приём пищи',
      'завтрак',
      'обед',
      'ужин',
      'перекус',
      'калори',
      'углев',
      'бжу',
      'кбжу',
      'xe',
      'хе',
      'ги',
      'гл',
    ]);
    const includeSleep = this.hasAny(text, [
      'сон',
      'спал',
      'спала',
      'ночь',
      'заснул',
      'проснул',
    ]);
    const includeActivity = this.hasAny(text, [
      'активност',
      'трениров',
      'шаг',
      'кардио',
      'бег',
      'ходьб',
      'спорт',
      'пульс',
      'fitness',
    ]);
    const includeInsulin = this.hasAny(text, [
      'инсулин',
      'болюс',
      'базал',
      'доза',
      'коррекц',
    ]);
    const includeLabs =
      includeGlucose ||
      this.hasAny(text, [
        'анализ',
        'лаборат',
        'липид',
        'холест',
        'креатинин',
        'алт',
        'аст',
        'с-пептид',
      ]);
    const includeInsights =
      this.hasAny(text, [
        'почему',
        'что происходит',
        'объясни',
        'итог',
        'сводк',
        'тренд',
        'за вчера',
        'за сегодня',
        'за неделю',
      ]) ||
      (!includeGlucose &&
        !includeMeals &&
        !includeSleep &&
        !includeActivity &&
        !includeInsulin &&
        !includeLabs);
    const includeDoctorNotes = this.hasAny(text, [
      'врач',
      'доктор',
      'выписк',
      'назнач',
      'рекомендац',
      'диагноз',
      'консультац',
      'прием врача',
      'приём врача',
      'препарат',
      'лекарств',
      'рецепт',
    ]);

    const roleScope = this.baseScopeForRole(assistantRole);

    return {
      includeLabs: includeLabs || roleScope.includeLabs,
      includeMeals: includeMeals || roleScope.includeMeals,
      includeGlucose: includeGlucose || roleScope.includeGlucose,
      includeSleep: includeSleep || roleScope.includeSleep,
      includeActivity: includeActivity || roleScope.includeActivity,
      includeInsulin: includeInsulin || roleScope.includeInsulin,
      includeDoctorNotes: includeDoctorNotes || roleScope.includeDoctorNotes,
      includeInsights: includeInsights || roleScope.includeInsights,
    };
  }

  private hasAny(text: string, patterns: string[]) {
    return patterns.some((pattern) => text.includes(pattern));
  }

  private buildConversationTitle(
    message: string,
    assistantRole: AssistantRole,
  ) {
    const roleTitle = this.displayTitleForRole(assistantRole);
    const normalized = message.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return roleTitle;
    }

    if (normalized.length <= 40) {
      return `${roleTitle}: ${normalized}`;
    }

    return `${roleTitle}: ${normalized.slice(0, 37).trimEnd()}...`;
  }

  private buildRoleSystemPrompt(role: AssistantRole) {
    switch (role) {
      case 'nutritionist':
        return 'Ты DiAgent-диетолог. Твоя зона ответственности: еда, КБЖУ, ХЕ, ГИ/ГЛ, состав приёмов пищи, пищевые привычки и практичные рекомендации по рациону при диабете.';
      case 'coach':
        return 'Ты DiAgent-тренер. Твоя зона ответственности: активность, шаги, тренировки, сон, восстановление, режим и их влияние на самочувствие и сахар.';
      case 'endocrinologist':
      default:
        return 'Ты DiAgent-эндокринолог. Твоя зона ответственности: сахар, инсулин, анализы, риски гипо/гипергликемии, связь еды и активности с глюкозой.';
    }
  }

  private baseScopeForRole(role: AssistantRole): AssistantContextScope {
    switch (role) {
      case 'nutritionist':
        return {
          includeLabs: false,
          includeMeals: true,
          includeGlucose: true,
          includeSleep: false,
          includeActivity: false,
          includeInsulin: false,
          includeDoctorNotes: true,
          includeInsights: true,
        };
      case 'coach':
        return {
          includeLabs: false,
          includeMeals: false,
          includeGlucose: true,
          includeSleep: true,
          includeActivity: true,
          includeInsulin: false,
          includeDoctorNotes: false,
          includeInsights: true,
        };
      case 'endocrinologist':
      default:
        return {
          includeLabs: true,
          includeMeals: true,
          includeGlucose: true,
          includeSleep: false,
          includeActivity: false,
          includeInsulin: true,
          includeDoctorNotes: true,
          includeInsights: true,
        };
    }
  }

  private displayTitleForRole(role: AssistantRole) {
    switch (role) {
      case 'nutritionist':
        return 'Диетолог';
      case 'coach':
        return 'Тренер';
      case 'endocrinologist':
      default:
        return 'Эндокринолог';
    }
  }
}
