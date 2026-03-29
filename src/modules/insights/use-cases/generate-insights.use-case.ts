import { Injectable } from '@nestjs/common';
import { InsightSeverity, InsightType } from '@prisma/client';
import { toInputJsonValue } from '../../../shared/utils/json.util';
import { InsightsRepository } from '../repositories/insights.repository';

@Injectable()
export class GenerateInsightsUseCase {
  constructor(private readonly insightsRepository: InsightsRepository) {}

  async execute(userId: string): Promise<void> {
    const [labs, meals, timeline] =
      await this.insightsRepository.getContext(userId);
    const generated: Array<{
      type: InsightType;
      severity: InsightSeverity;
      title: string;
      summary: string;
      payload: Record<string, unknown>;
    }> = [];

    const latestHba1c = labs.find(
      (lab: (typeof labs)[number]) => lab.type === 'HBA1C',
    );

    if (latestHba1c) {
      const hba1cValue = Number(latestHba1c.value);
      generated.push({
        type: InsightType.LAB_TREND,
        severity:
          hba1cValue >= 7.5
            ? InsightSeverity.CRITICAL
            : hba1cValue >= 6.5
              ? InsightSeverity.WARNING
              : InsightSeverity.INFO,
        title: 'HbA1c trend',
        summary:
          hba1cValue >= 6.5
            ? `Latest HbA1c is ${hba1cValue}, which suggests elevated long-term glucose exposure.`
            : `Latest HbA1c is ${hba1cValue}, which is within a safer range.`,
        payload: {
          value: hba1cValue,
          measuredAt: latestHba1c.measuredAt,
        },
      });
    }

    const recentGlucoseLabs = labs
      .filter((lab: (typeof labs)[number]) =>
        ['GLUCOSE', 'FASTING_GLUCOSE', 'POSTPRANDIAL_GLUCOSE'].includes(
          lab.type,
        ),
      )
      .slice(0, 5);

    if (recentGlucoseLabs.length > 0) {
      const average =
        recentGlucoseLabs.reduce(
          (sum: number, item: (typeof recentGlucoseLabs)[number]) =>
            sum + Number(item.value),
          0,
        ) / recentGlucoseLabs.length;

      generated.push({
        type: InsightType.GLUCOSE_PATTERN,
        severity:
          average >= 140
            ? InsightSeverity.CRITICAL
            : average >= 110
              ? InsightSeverity.WARNING
              : InsightSeverity.INFO,
        title: 'Recent glucose pattern',
        summary: `Average of the latest ${recentGlucoseLabs.length} glucose-related readings is ${average.toFixed(1)} ${recentGlucoseLabs[0].unit}.`,
        payload: {
          average,
          sampleIds: recentGlucoseLabs.map(
            (item: (typeof recentGlucoseLabs)[number]) => item.id,
          ),
        },
      });
    }

    const latestHighCarbMeal = meals.find(
      (meal: (typeof meals)[number]) => Number(meal.carbohydrates ?? 0) >= 70,
    );

    if (latestHighCarbMeal) {
      generated.push({
        type: InsightType.MEAL_IMPACT,
        severity: InsightSeverity.WARNING,
        title: 'High-carb meal detected',
        summary: `Meal "${latestHighCarbMeal.title}" contains approximately ${Number(
          latestHighCarbMeal.carbohydrates,
        )}g carbs and may correlate with later glucose spikes.`,
        payload: {
          mealId: latestHighCarbMeal.id,
          loggedAt: latestHighCarbMeal.loggedAt,
        },
      });
    }

    if (timeline.length >= 10) {
      generated.push({
        type: InsightType.ADHERENCE,
        severity: InsightSeverity.INFO,
        title: 'Data coverage',
        summary: `You have ${timeline.length} recent timeline events, which is enough to support trend analysis and assistant context.`,
        payload: {
          timelineEvents: timeline.length,
        },
      });
    }

    await this.insightsRepository.replaceForUser(
      userId,
      generated.map((item) => ({
        ...item,
        payload: toInputJsonValue(item.payload),
      })),
    );
  }
}
