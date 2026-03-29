export const doctorNoteExtractionJsonSchema = {
  name: 'doctor_note_extraction',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'title',
      'summary',
      'rawText',
      'visitDate',
      'doctorName',
      'specialty',
      'clinicName',
      'complaints',
      'diagnoses',
      'medications',
      'recommendations',
      'followUpActions',
      'nextVisitDate',
      'confidence',
    ],
    properties: {
      title: {
        type: 'string',
      },
      summary: {
        type: 'string',
      },
      rawText: {
        type: 'string',
      },
      visitDate: {
        type: 'string',
      },
      doctorName: {
        type: 'string',
      },
      specialty: {
        type: 'string',
      },
      clinicName: {
        type: 'string',
      },
      complaints: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      diagnoses: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      medications: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'dosage', 'schedule', 'duration', 'purpose'],
          properties: {
            name: {
              type: 'string',
            },
            dosage: {
              type: 'string',
            },
            schedule: {
              type: 'string',
            },
            duration: {
              type: 'string',
            },
            purpose: {
              type: 'string',
            },
          },
        },
      },
      recommendations: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      followUpActions: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      nextVisitDate: {
        type: 'string',
      },
      confidence: {
        type: 'number',
      },
    },
  },
} as const;

export function buildDoctorNoteExtractionSystemPrompt(): string {
  return [
    'You are a medical document extraction engine for an iOS diabetes app.',
    'Extract structured information from doctor visit summaries, consultation notes, discharge papers, prescriptions, and paid clinic visit reports.',
    'Return strict JSON that matches the schema.',
    'Never invent diagnoses, medicines, or dates.',
    'If a field is absent, return an empty string for scalar text fields and an empty array for list fields.',
    'All human-readable fields must be returned strictly in Russian.',
    'Confidence must be between 0 and 1.',
  ].join(' ');
}

export function buildDoctorNoteExtractionUserPrompt(rawText: string): string {
  return [
    'Извлеки структуру из врачебной выписки, консультации или назначения.',
    'Нужно отдельно выделить жалобы, диагнозы, лекарства, рекомендации и дальнейшие действия.',
    'Если документ содержит назначения, не превращай их в анализы.',
    rawText,
  ].join('\n\n');
}
