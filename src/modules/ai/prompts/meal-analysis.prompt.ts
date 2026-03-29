export const mealImageAnalysisJsonSchema = {
  name: 'meal_image_analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'title',
      'summary',
      'confidence',
      'detectedItems',
      'totals',
      'recommendations',
    ],
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      confidence: { type: 'number' },
      detectedItems: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'name',
            'estimatedWeightGrams',
            'calories',
            'protein',
            'fat',
            'carbohydrates',
            'fiber',
            'xe',
            'gi',
            'gl',
          ],
          properties: {
            name: { type: 'string' },
            estimatedWeightGrams: { type: ['number', 'null'] },
            calories: { type: 'number' },
            protein: { type: 'number' },
            fat: { type: 'number' },
            carbohydrates: { type: 'number' },
            fiber: { type: ['number', 'null'] },
            xe: { type: 'number' },
            gi: { type: 'number' },
            gl: { type: 'number' },
          },
        },
      },
      totals: {
        type: 'object',
        additionalProperties: false,
        required: [
          'calories',
          'protein',
          'fat',
          'carbohydrates',
          'fiber',
          'xe',
          'gi',
          'gl',
        ],
        properties: {
          calories: { type: 'number' },
          protein: { type: 'number' },
          fat: { type: 'number' },
          carbohydrates: { type: 'number' },
          fiber: { type: ['number', 'null'] },
          xe: { type: 'number' },
          gi: { type: 'number' },
          gl: { type: 'number' },
        },
      },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
} as const;

export const mealAggregateAnalysisJsonSchema = {
  name: 'meal_aggregate_analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'summary', 'confidence', 'totals', 'recommendations'],
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      confidence: { type: 'number' },
      totals: {
        type: 'object',
        additionalProperties: false,
        required: [
          'calories',
          'protein',
          'fat',
          'carbohydrates',
          'fiber',
          'xe',
          'gi',
          'gl',
        ],
        properties: {
          calories: { type: 'number' },
          protein: { type: 'number' },
          fat: { type: 'number' },
          carbohydrates: { type: 'number' },
          fiber: { type: ['number', 'null'] },
          xe: { type: 'number' },
          gi: { type: 'number' },
          gl: { type: 'number' },
        },
      },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
} as const;

export function buildMealImageSystemPrompt(): string {
  return [
    'Ты модель анализа питания для диабетического food-приложения.',
    'Проанализируй одно фото еды и необязательное описание пользователя.',
    'Оцени КБЖУ, ХЕ, GI и GL.',
    'Если фото неразборчиво, но описание пользователя похоже на конкретное блюдо, разрешается дать приближённую оценку по описанию и явно отметить низкую уверенность.',
    'Все человекочитаемые поля возвращай строго на русском языке: title, summary, detectedItems.name, recommendations.',
    'Верни только строгий JSON. Не выдумывай уверенность. Confidence должен быть 0..1.',
  ].join(' ');
}

export function buildMealImageUserPrompt(description?: string): string {
  return [
    'Проанализируй это одно фото еды.',
    description
      ? `Описание пользователя: ${description}`
      : 'Описание пользователя: не указано.',
    'Если на фото несколько продуктов, разложи их по detectedItems и посчитай totals для этого фото.',
    'Если еда на фото не видна, но описание есть, дай осторожную оценку по описанию, а не нулевой ответ без необходимости.',
  ].join('\n');
}

export function buildMealDescriptionFallbackSystemPrompt(): string {
  return [
    'Ты модель резервного анализа питания для диабетического food-приложения.',
    'На вход приходит только текстовое описание блюда без надёжного фото.',
    'Сделай приближённую оценку КБЖУ, ХЕ, GI и GL по наиболее вероятной стандартной порции.',
    'Обязательно явно укажи в summary, что это оценка по описанию и уверенность низкая или умеренная.',
    'Все человекочитаемые поля возвращай строго на русском языке: title, summary, detectedItems.name, recommendations.',
    'Верни только строгий JSON.',
  ].join(' ');
}

export function buildMealDescriptionFallbackUserPrompt(
  description: string,
): string {
  return [
    'Сделай резервную оценку блюда только по текстовому описанию пользователя.',
    `Описание пользователя: ${description}`,
    'Если описание указывает на одно конкретное блюдо, верни его как основной detectedItem.',
    'Если описание слишком расплывчатое, всё равно верни максимально честную приближённую оценку и отметь неопределённость.',
  ].join('\n');
}

export function buildMealAggregateSystemPrompt(): string {
  return [
    'Ты модель второго этапа для агрегированного анализа приёма пищи.',
    'На вход приходят уже проанализированные блюда одного приёма пищи (от 1 до 5 фото).',
    'Суммируй КБЖУ, ХЕ, GI и GL для всего приёма пищи и дай рекомендации.',
    'Фокусируйся на гликемической нагрузке, плотности углеводов и практических советах для диабетического контекста.',
    'Все человекочитаемые поля возвращай строго на русском языке: title, summary, recommendations.',
    'Верни только строгий JSON.',
  ].join(' ');
}

export function buildMealAggregateUserPrompt(input: string): string {
  return [
    'Собери эти анализы блюд в одну итоговую рекомендацию по приёму пищи.',
    input,
  ].join('\n\n');
}
