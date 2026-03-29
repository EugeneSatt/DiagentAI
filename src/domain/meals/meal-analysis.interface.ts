export interface MealAnalysisDetectedItem {
  name: string;
  estimatedWeightGrams: number | null;
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  fiber: number | null;
  xe: number;
  gi: number;
  gl: number;
}

export interface MealImageAnalysisResult {
  title: string;
  summary: string;
  confidence: number;
  detectedItems: MealAnalysisDetectedItem[];
  totals: {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
    fiber: number | null;
    xe: number;
    gi: number;
    gl: number;
  };
  recommendations: string[];
}

export interface MealAggregateAnalysisResult {
  title: string;
  summary: string;
  confidence: number;
  totals: {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
    fiber: number | null;
    xe: number;
    gi: number;
    gl: number;
  };
  recommendations: string[];
}
