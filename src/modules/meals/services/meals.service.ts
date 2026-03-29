import { Injectable } from '@nestjs/common';
import { MealAnalysisDetectedItem } from '../../../domain/meals/meal-analysis.interface';
import { AnalyzeMealUploadDto } from '../dto/analyze-meal-upload.dto';
import { CreateMealDto } from '../dto/create-meal.dto';
import { MealsRepository } from '../repositories/meals.repository';
import { AnalyzeMealUploadUseCase } from '../use-cases/analyze-meal-upload.use-case';
import { CreateMealUseCase } from '../use-cases/create-meal.use-case';
import { ProcessMealAnalysisUseCase } from '../use-cases/process-meal-analysis.use-case';

type MealListItem = Awaited<ReturnType<MealsRepository['list']>>[number];
type MealLatestItem = Awaited<ReturnType<MealsRepository['latest']>>[number];
type MealDetailItem = Awaited<ReturnType<MealsRepository['getDetail']>>;

@Injectable()
export class MealsService {
  constructor(
    private readonly createMealUseCase: CreateMealUseCase,
    private readonly analyzeMealUploadUseCase: AnalyzeMealUploadUseCase,
    private readonly processMealAnalysisUseCase: ProcessMealAnalysisUseCase,
    private readonly mealsRepository: MealsRepository,
  ) {}

  analyzeUpload(
    userId: string,
    dto: AnalyzeMealUploadDto,
    files: Express.Multer.File[] | undefined,
  ) {
    return this.analyzeMealUploadUseCase.execute(userId, dto, files);
  }

  create(userId: string, dto: CreateMealDto) {
    return this.createMealUseCase.execute(userId, dto);
  }

  async list(userId: string) {
    const meals = await this.mealsRepository.list(userId);

    return meals.map((meal) => this.sanitizeMealListItem(meal));
  }

  async detail(userId: string, mealId: string) {
    const meal = await this.mealsRepository.getDetail(userId, mealId);

    return this.toMealDetailResponse(meal);
  }

  status(userId: string, mealId: string) {
    return this.mealsRepository.getStatus(userId, mealId);
  }

  async latest(userId: string, limit: number) {
    const meals = await this.mealsRepository.latest(userId, limit);

    return meals.map((meal) => this.sanitizeMealLatestItem(meal));
  }

  processAnalysis(mealId: string) {
    return this.processMealAnalysisUseCase.execute(mealId);
  }

  private sanitizeMealListItem(meal: MealListItem) {
    const photoUrl = this.toPublicUrlOrNull(meal.photoUrl);
    const components = meal.components.map((component) => ({
      ...component,
      imageUrl: this.toPublicUrlOrNull(component.imageUrl),
    }));

    return {
      ...meal,
      photoUrl,
      photos: this.buildPhotosArray({
        fallbackDescription: meal.description,
        fallbackPhotoUrl: photoUrl,
        components,
        mealId: meal.id,
      }),
      components,
    };
  }

  private sanitizeMealLatestItem(meal: MealLatestItem) {
    const photoUrl = this.toPublicUrlOrNull(meal.photoUrl);

    return {
      ...meal,
      photoUrl,
      photos: this.buildPhotosArray({
        fallbackDescription: meal.description,
        fallbackPhotoUrl: photoUrl,
        components: [],
        mealId: meal.id,
      }),
    };
  }

  private toPublicUrlOrNull(value: string | null): string | null {
    return value && /^https?:\/\//i.test(value) ? value : null;
  }

  private toMealDetailResponse(meal: MealDetailItem) {
    const items = meal.components.flatMap((component, index) =>
      this.expandComponentDetailItems(component, index),
    );
    const fallbackSummary = this.buildFallbackSummary(items);

    return {
      items,
      summary: this.buildMealSummary(meal, fallbackSummary),
      recommendation: this.buildRecommendationText(meal),
    };
  }

  private expandComponentDetailItems(
    component: MealDetailItem['components'][number],
    index: number,
  ) {
    const imageUrl = this.toPublicUrlOrNull(component.imageUrl);
    const detectedItems = this.extractDetectedItems(component.analysis);

    if (detectedItems.length > 0) {
      return detectedItems.map((item, detectedIndex) => ({
        title: item.name.trim() || `Блюдо ${index + 1}.${detectedIndex + 1}`,
        imageUrl,
        calories: this.toNumber(item.calories),
        protein: this.toNumber(item.protein),
        fat: this.toNumber(item.fat),
        carbs: this.toNumber(item.carbohydrates),
        xe: this.toNumber(item.xe),
        gi: this.toNumber(item.gi),
        gl: this.toNumber(item.gl),
      }));
    }

    return [
      {
        title: this.resolveComponentTitle(component, index),
        imageUrl,
        calories: this.toNumber(component.calories),
        protein: this.toNumber(component.protein),
        fat: this.toNumber(component.fat),
        carbs: this.toNumber(component.carbohydrates),
        xe: this.toNumber(component.xe),
        gi: this.toNumber(component.glycemicIndex),
        gl: this.toNumber(component.glycemicLoad),
      },
    ];
  }

  private buildPhotosArray(input: {
    mealId: string;
    fallbackPhotoUrl: string | null;
    fallbackDescription: string | null;
    components: Array<{
      id: string;
      ordinal: number;
      imageUrl: string | null;
      description: string | null;
    }>;
  }) {
    const photosFromComponents = input.components
      .filter((component) => component.imageUrl)
      .map((component) => ({
        id: component.id,
        ordinal: component.ordinal,
        url: component.imageUrl as string,
        description: component.description,
      }));

    if (photosFromComponents.length > 0) {
      return photosFromComponents;
    }

    if (!input.fallbackPhotoUrl) {
      return [];
    }

    return [
      {
        id: `${input.mealId}-cover`,
        ordinal: 0,
        url: input.fallbackPhotoUrl,
        description: input.fallbackDescription,
      },
    ];
  }

  private resolveComponentTitle(
    component: MealDetailItem['components'][number],
    index: number,
  ): string {
    const description = component.description?.trim();
    if (description) {
      return description;
    }

    const title = component.title?.trim();
    if (title) {
      return title;
    }

    return `Блюдо ${index + 1}`;
  }

  private buildRecommendationText(meal: MealDetailItem): string {
    const recommendations = Array.isArray(meal.recommendations)
      ? meal.recommendations.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
      : [];

    if (recommendations.length > 0) {
      return recommendations.join('\n');
    }

    return meal.summary?.trim() || 'Рекомендации будут доступны после анализа.';
  }

  private buildMealSummary(
    meal: MealDetailItem,
    fallbackSummary: {
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
      xe: number;
      gi: number;
      gl: number;
    },
  ) {
    const storedSummary = {
      calories: this.toNumber(meal.calories),
      protein: this.toNumber(meal.protein),
      fat: this.toNumber(meal.fat),
      carbs: this.toNumber(meal.carbohydrates),
      xe: this.toNumber(meal.xe),
      gi: this.toNumber(meal.glycemicIndex),
      gl: this.toNumber(meal.glycemicLoad),
    };

    if (this.hasMeaningfulSummary(storedSummary)) {
      return storedSummary;
    }

    return fallbackSummary;
  }

  private buildFallbackSummary(
    items: Array<{
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
      xe: number;
      gi: number;
      gl: number;
    }>,
  ) {
    const totals = items.reduce(
      (accumulator, item) => ({
        calories: accumulator.calories + item.calories,
        protein: accumulator.protein + item.protein,
        fat: accumulator.fat + item.fat,
        carbs: accumulator.carbs + item.carbs,
        xe: accumulator.xe + item.xe,
        gl: accumulator.gl + item.gl,
      }),
      {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        xe: 0,
        gl: 0,
      },
    );

    return {
      ...totals,
      gi:
        totals.carbs > 0
          ? Number(((totals.gl * 100) / totals.carbs).toFixed(1))
          : 0,
    };
  }

  private hasMeaningfulSummary(summary: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    xe: number;
    gi: number;
    gl: number;
  }) {
    return Object.values(summary).some((value) => value > 0);
  }

  private extractDetectedItems(
    analysis: MealDetailItem['components'][number]['analysis'],
  ): MealAnalysisDetectedItem[] {
    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
      return [];
    }

    const detectedItems = (analysis as Record<string, unknown>).detectedItems;

    if (!Array.isArray(detectedItems)) {
      return [];
    }

    return detectedItems.filter((item): item is MealAnalysisDetectedItem =>
      this.isDetectedItem(item),
    );
  }

  private isDetectedItem(value: unknown): value is MealAnalysisDetectedItem {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const item = value as Record<string, unknown>;

    return (
      typeof item.name === 'string' &&
      typeof item.calories === 'number' &&
      typeof item.protein === 'number' &&
      typeof item.fat === 'number' &&
      typeof item.carbohydrates === 'number' &&
      typeof item.xe === 'number' &&
      typeof item.gi === 'number' &&
      typeof item.gl === 'number' &&
      (typeof item.estimatedWeightGrams === 'number' ||
        item.estimatedWeightGrams === null) &&
      (typeof item.fiber === 'number' || item.fiber === null)
    );
  }

  private toNumber(value: { toString(): string } | null | undefined): number {
    if (!value) {
      return 0;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsedFromString = Number(value);
      return Number.isFinite(parsedFromString) ? parsedFromString : 0;
    }

    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
