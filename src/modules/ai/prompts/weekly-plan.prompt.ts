export const fitnessWeeklyPlanJsonSchema = {
  name: 'fitness_weekly_plan',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'summary', 'recommendation', 'days'],
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      recommendation: { type: 'string' },
      days: {
        type: 'array',
        minItems: 7,
        maxItems: 7,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'dayLabel',
            'focus',
            'goal',
            'durationMinutes',
            'activities',
            'notes',
          ],
          properties: {
            dayLabel: { type: 'string' },
            focus: { type: 'string' },
            goal: { type: 'string' },
            durationMinutes: { type: 'number' },
            activities: {
              type: 'array',
              items: { type: 'string' },
            },
            notes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

export const mealWeeklyPlanJsonSchema = {
  name: 'meal_weekly_plan',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'summary', 'recommendation', 'days'],
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      recommendation: { type: 'string' },
      days: {
        type: 'array',
        minItems: 7,
        maxItems: 7,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'dayLabel',
            'breakfast',
            'lunch',
            'dinner',
            'snack',
            'notes',
          ],
          properties: {
            dayLabel: { type: 'string' },
            breakfast: {
              type: 'array',
              items: { type: 'string' },
            },
            lunch: {
              type: 'array',
              items: { type: 'string' },
            },
            dinner: {
              type: 'array',
              items: { type: 'string' },
            },
            snack: {
              type: 'array',
              items: { type: 'string' },
            },
            notes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

export function buildFitnessPlanSystemPrompt(): string {
  return [
    'Ты спортивный коуч и специалист по безопасной нагрузке для человека с диабетическим/метаболическим контекстом.',
    'Составь план тренировок строго на 7 дней календарной недели.',
    'Пиши по-русски.',
    'Учитывай: рост, вес, цель пользователя, его описание, сон, активность, еду и сахар за последние дни.',
    'План должен быть реалистичным, без экстремальных нагрузок, с днями восстановления.',
    'Если данных мало, всё равно дай мягкий и безопасный план средней интенсивности.',
    'Никаких медицинских диагнозов и запугивания.',
    'Верни только JSON по схеме.',
  ].join(' ');
}

export function buildFitnessPlanUserPrompt(input: {
  weekLabel: string;
  profile: string;
  context: string;
}): string {
  return [
    `Собери weekly fitness plan на неделю: ${input.weekLabel}.`,
    `Профиль пользователя: ${input.profile}.`,
    `Контекст последних данных: ${input.context}.`,
  ].join('\n\n');
}

export function buildMealPlanSystemPrompt(): string {
  return [
    'Ты диетолог для iOS health-приложения.',
    'Составь рацион строго на 7 дней календарной недели.',
    'Пиши по-русски.',
    'На каждый день дай завтрак, обед, ужин и перекус.',
    'Учитывай цель пользователя, описание пользователя, вес/рост, последние приёмы пищи, сон, активность и сахар.',
    'Если есть предпочтения по еде, обязательно встрои их в рацион.',
    'Рацион должен быть бытовым, понятным и без экзотики.',
    'Верни только JSON по схеме.',
  ].join(' ');
}

export function buildMealPlanUserPrompt(input: {
  weekLabel: string;
  profile: string;
  preferences?: string;
  context: string;
}): string {
  return [
    `Собери weekly meal plan на неделю: ${input.weekLabel}.`,
    `Профиль пользователя: ${input.profile}.`,
    input.preferences?.trim()
      ? `Предпочтения пользователя по еде: ${input.preferences.trim()}.`
      : 'Предпочтения по еде не указаны.',
    `Контекст последних данных: ${input.context}.`,
  ].join('\n\n');
}

export function buildLabsSummarySystemPrompt(): string {
  return [
    'Ты медицинский AI-помощник, который кратко объясняет результаты анализов для пользователя.',
    'Пиши по-русски, коротко, безопасно и понятно.',
    'Не ставь диагнозы.',
    'Сделай короткую сводку: что выглядит нормальным, что требует внимания и какие анализы стоит пересмотреть с врачом.',
  ].join(' ');
}

export function buildLabsSummaryUserPrompt(input: {
  profile: string;
  labs: string;
}): string {
  return [
    `Профиль пользователя: ${input.profile}.`,
    `Последние лабораторные показатели: ${input.labs}.`,
    'Сделай короткую текстовую сводку для блока "Анализы".',
  ].join('\n\n');
}
