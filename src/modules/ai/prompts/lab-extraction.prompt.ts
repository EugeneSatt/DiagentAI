export const labExtractionJsonSchema = {
  name: 'lab_report_extraction',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'rawText', 'items'],
    properties: {
      summary: {
        type: 'string',
      },
      rawText: {
        type: 'string',
      },
      observedAt: {
        type: 'string',
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'name',
            'normalizedName',
            'type',
            'value',
            'unit',
            'status',
            'confidence',
          ],
          properties: {
            name: {
              type: 'string',
            },
            normalizedName: {
              type: 'string',
            },
            type: {
              type: 'string',
              enum: [
                'HBA1C',
                'GLUCOSE',
                'FASTING_GLUCOSE',
                'POSTPRANDIAL_GLUCOSE',
                'INSULIN',
                'C_PEPTIDE',
                'LDL',
                'HDL',
                'TRIGLYCERIDES',
                'CREATININE',
                'ALT',
                'AST',
                'OTHER',
              ],
            },
            value: {
              type: 'number',
            },
            unit: {
              type: 'string',
            },
            referenceRange: {
              type: 'object',
              additionalProperties: false,
              properties: {
                low: {
                  type: 'number',
                },
                high: {
                  type: 'number',
                },
                text: {
                  type: 'string',
                },
              },
            },
            status: {
              type: 'string',
              enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL', 'UNKNOWN'],
            },
            confidence: {
              type: 'number',
            },
            measuredAt: {
              type: 'string',
            },
          },
        },
      },
    },
  },
} as const;

export function buildVisionOcrPrompt(): string {
  return [
    'You are an OCR and medical table transcription engine.',
    'Extract all visible text from the lab report image.',
    'Preserve numbers, units, dates, table headers, and reference ranges.',
    'Return plain text only.',
  ].join(' ');
}

export function buildLabExtractionSystemPrompt(): string {
  return [
    'You are a medical data extraction engine for an iOS diabetes app.',
    'Convert lab report content into strict JSON that matches the schema.',
    'Never invent lab values. Use OTHER when no exact lab type matches.',
    'Status rules: LOW/HIGH/CRITICAL if explicitly inferable from reference range, otherwise UNKNOWN.',
    'Confidence must be between 0 and 1.',
  ].join(' ');
}

export function buildLabExtractionUserPrompt(rawText: string): string {
  return [
    'Extract structured lab results from the following lab report text.',
    'Focus on biomarkers, numeric results, units, dates, and reference ranges.',
    rawText,
  ].join('\n\n');
}
