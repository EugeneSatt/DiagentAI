export interface FitnessPlanDay {
  dayLabel: string;
  focus: string;
  goal: string;
  durationMinutes: number;
  activities: string[];
  notes: string[];
}

export interface FitnessWeeklyPlanResult {
  title: string;
  summary: string;
  recommendation: string;
  days: FitnessPlanDay[];
}

export interface MealPlanDay {
  dayLabel: string;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  snack: string[];
  notes: string[];
}

export interface MealWeeklyPlanResult {
  title: string;
  summary: string;
  recommendation: string;
  days: MealPlanDay[];
}
