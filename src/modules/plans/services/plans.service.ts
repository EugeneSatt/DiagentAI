import { BadGatewayException, Injectable } from '@nestjs/common';
import { GeneratedPlanType, Prisma } from '@prisma/client';
import { toInputJsonValue } from '../../../shared/utils/json.util';
import { AiService } from '../../ai/services/ai.service';
import { GeneratePlanDto } from '../dto/generate-plan.dto';
import { PlansRepository } from '../repositories/plans.repository';

@Injectable()
export class PlansService {
  constructor(
    private readonly plansRepository: PlansRepository,
    private readonly aiService: AiService,
  ) {}

  async getCurrentFitnessPlan(userId: string) {
    return this.getCurrentPlan(userId, GeneratedPlanType.FITNESS);
  }

  async getCurrentMealPlan(userId: string) {
    return this.getCurrentPlan(userId, GeneratedPlanType.MEAL);
  }

  async generateFitnessPlan(userId: string) {
    return this.generatePlan(userId, GeneratedPlanType.FITNESS, {});
  }

  async generateMealPlan(userId: string, dto: GeneratePlanDto) {
    return this.generatePlan(userId, GeneratedPlanType.MEAL, dto);
  }

  private async getCurrentPlan(userId: string, type: GeneratedPlanType) {
    const { weekStart, weekEnd, weekLabel } = this.getCurrentWeekBounds();
    const plan = await this.plansRepository.findCurrentPlan(
      userId,
      type,
      weekStart,
    );

    return {
      type,
      weekStart,
      weekEnd,
      weekLabel,
      canGenerate: !plan || plan.status === 'FAILED',
      plan: plan ? this.mapPlan(plan) : null,
    };
  }

  private async generatePlan(
    userId: string,
    type: GeneratedPlanType,
    dto: GeneratePlanDto,
  ) {
    const { weekStart, weekEnd, weekLabel } = this.getCurrentWeekBounds();
    const existing = await this.plansRepository.findCurrentPlan(
      userId,
      type,
      weekStart,
    );

    if (existing?.status === 'GENERATED') {
      return {
        type,
        weekStart,
        weekEnd,
        weekLabel,
        canGenerate: false,
        plan: this.mapPlan(existing),
      };
    }

    const context = await this.plansRepository.getGenerationContext(userId);
    const profileText = this.buildProfileText(context.user.profile);
    const contextText = this.buildContextText(context);

    try {
      const generated =
        type === GeneratedPlanType.FITNESS
          ? await this.aiService.generateFitnessPlan({
              weekLabel,
              profile: profileText,
              context: contextText,
            })
          : await this.aiService.generateMealPlan({
              weekLabel,
              profile: profileText,
              preferences: dto.preferences,
              context: contextText,
            });

      const saved = await this.plansRepository.upsertGeneratedPlan({
        userId,
        type,
        weekStart,
        weekEnd,
        title: generated.title,
        summary: generated.summary,
        recommendation: generated.recommendation,
        payload: toInputJsonValue(generated),
        preferences: toInputJsonValue({
          preferences: dto.preferences ?? null,
        }),
        model: process.env.COMET_TEXT_MODEL,
      });

      return {
        type,
        weekStart,
        weekEnd,
        weekLabel,
        canGenerate: false,
        plan: this.mapPlan(saved),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Plan generation failed';

      await this.plansRepository.failGeneratedPlan({
        userId,
        type,
        weekStart,
        weekEnd,
        failureReason: message,
        preferences: toInputJsonValue({
          preferences: dto.preferences ?? null,
        }),
        model: process.env.COMET_TEXT_MODEL,
      });

      throw new BadGatewayException('Не удалось собрать план на эту неделю');
    }
  }

  private mapPlan(plan: {
    id: string;
    type: GeneratedPlanType;
    status: string;
    weekStart: Date;
    weekEnd: Date;
    generatedAt: Date;
    title: string;
    summary: string;
    recommendation: string;
    payload: Prisma.JsonValue;
    preferences: Prisma.JsonValue | null;
  }) {
    return {
      id: plan.id,
      type: plan.type,
      status: plan.status,
      weekStart: plan.weekStart,
      weekEnd: plan.weekEnd,
      generatedAt: plan.generatedAt,
      title: plan.title,
      summary: plan.summary,
      recommendation: plan.recommendation,
      preferences: this.normalizeJsonObject(plan.preferences),
      ...this.normalizeJsonObject(plan.payload),
    };
  }

  private buildProfileText(profile: Prisma.JsonValue | null): string {
    const normalized = this.normalizeJsonObject(profile);
    const age = this.readNumber(normalized.age);
    const diabetesType = this.readString(normalized.diabetesType);
    const weightKg = this.readNumber(normalized.weightKg);
    const heightCm = this.readNumber(normalized.heightCm);
    const goal = this.readString(normalized.goal);
    const about = this.readString(normalized.about);
    const proteinTarget = this.readNumber(normalized.proteinTarget);
    const fatTarget = this.readNumber(normalized.fatTarget);
    const carbsTarget = this.readNumber(normalized.carbsTarget);

    const parts = [
      age !== null ? `Возраст: ${age}` : null,
      diabetesType ? `Тип диабета: ${diabetesType}` : null,
      weightKg !== null ? `Вес: ${weightKg} кг` : null,
      heightCm !== null ? `Рост: ${heightCm} см` : null,
      goal ? `Цель: ${goal}` : null,
      about ? `Описание пользователя: ${about}` : null,
      proteinTarget !== null ? `Цель по белку: ${proteinTarget} г` : null,
      fatTarget !== null ? `Цель по жирам: ${fatTarget} г` : null,
      carbsTarget !== null ? `Цель по углеводам: ${carbsTarget} г` : null,
    ].filter(Boolean);

    return parts.length > 0
      ? parts.join('; ')
      : 'Профиль заполнен минимально, используй безопасные базовые рекомендации.';
  }

  private buildContextText(
    context: Awaited<ReturnType<PlansRepository['getGenerationContext']>>,
  ): string {
    const meals = context.meals.slice(0, 6).map((meal) => ({
      title: meal.title,
      loggedAt: meal.loggedAt,
      calories: meal.calories?.toString() ?? null,
      carbs: meal.carbohydrates?.toString() ?? null,
      xe: meal.xe?.toString() ?? null,
      gi: meal.glycemicIndex?.toString() ?? null,
      gl: meal.glycemicLoad?.toString() ?? null,
    }));

    const healthMetrics = context.healthMetrics.slice(0, 20).map((metric) => ({
      type: metric.type,
      value: metric.value.toString(),
      unit: metric.unit,
      sampledAt: metric.sampledAt,
    }));

    const labs = context.labs.slice(0, 10).map((lab) => ({
      type: lab.type,
      name: lab.normalizedName,
      value: lab.value.toString(),
      unit: lab.unit,
      measuredAt: lab.measuredAt,
      status: lab.status,
    }));

    const insights = context.insights.slice(0, 6).map((insight) => ({
      title: insight.title,
      summary: insight.summary,
      severity: insight.severity,
    }));

    return JSON.stringify(
      {
        meals,
        healthMetrics,
        labs,
        insights,
      },
      null,
      2,
    );
  }

  private getCurrentWeekBounds() {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - distanceToMonday);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const formatter = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
    });

    return {
      weekStart,
      weekEnd,
      weekLabel: `${formatter.format(weekStart)} — ${formatter.format(weekEnd)}`,
    };
  }

  private normalizeJsonObject(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
