import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import pdfParse from 'pdf-parse';
import { DoctorNoteExtractionResult } from '../../../domain/documents/doctor-note-extraction.interface';
import { LabDocumentExtractionResult } from '../../../domain/labs/lab-extraction.interface';
import {
  MealAggregateAnalysisResult,
  MealImageAnalysisResult,
} from '../../../domain/meals/meal-analysis.interface';
import {
  FitnessWeeklyPlanResult,
  MealWeeklyPlanResult,
} from '../../../domain/plans/generated-plan.interface';
import { CometService } from '../../../infrastructure/comet/comet.service';
import {
  buildDoctorNoteExtractionSystemPrompt,
  buildDoctorNoteExtractionUserPrompt,
  doctorNoteExtractionJsonSchema,
} from '../prompts/doctor-note-extraction.prompt';
import {
  buildLabExtractionSystemPrompt,
  buildLabExtractionUserPrompt,
  buildVisionOcrPrompt,
  labExtractionJsonSchema,
} from '../prompts/lab-extraction.prompt';
import {
  buildMealDescriptionFallbackSystemPrompt,
  buildMealDescriptionFallbackUserPrompt,
  buildMealAggregateSystemPrompt,
  buildMealAggregateUserPrompt,
  buildMealImageSystemPrompt,
  buildMealImageUserPrompt,
  mealAggregateAnalysisJsonSchema,
  mealImageAnalysisJsonSchema,
} from '../prompts/meal-analysis.prompt';
import {
  buildFitnessPlanSystemPrompt,
  buildFitnessPlanUserPrompt,
  buildLabsSummarySystemPrompt,
  buildLabsSummaryUserPrompt,
  buildMealPlanSystemPrompt,
  buildMealPlanUserPrompt,
  fitnessWeeklyPlanJsonSchema,
  mealWeeklyPlanJsonSchema,
} from '../prompts/weekly-plan.prompt';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly cometService: CometService) {}

  async extractLabsFromDocument(input: {
    documentUrl: string;
    mimeType: string;
  }): Promise<LabDocumentExtractionResult> {
    this.logger.log(
      JSON.stringify({
        event: 'ai.extract-labs.started',
        mimeType: input.mimeType,
        documentUrl: input.documentUrl,
      }),
    );
    const rawText = await this.extractRawText(
      input.documentUrl,
      input.mimeType,
    );

    const result =
      await this.cometService.createStructuredOutput<LabDocumentExtractionResult>(
        [
          {
            role: 'system',
            content: buildLabExtractionSystemPrompt(),
          },
          {
            role: 'user',
            content: buildLabExtractionUserPrompt(rawText),
          },
        ],
        labExtractionJsonSchema,
        false,
      );
    this.logger.log(
      JSON.stringify({
        event: 'ai.extract-labs.completed',
        mimeType: input.mimeType,
        items: result.items.length,
        rawTextLength: result.rawText.length,
      }),
    );

    return result;
  }

  async extractDoctorNoteFromDocument(input: {
    documentUrl: string;
    mimeType: string;
  }): Promise<DoctorNoteExtractionResult> {
    this.logger.log(
      JSON.stringify({
        event: 'ai.extract-doctor-note.started',
        mimeType: input.mimeType,
        documentUrl: input.documentUrl,
      }),
    );
    const rawText = await this.extractRawText(
      input.documentUrl,
      input.mimeType,
    );

    const result =
      await this.cometService.createStructuredOutput<DoctorNoteExtractionResult>(
        [
          {
            role: 'system',
            content: buildDoctorNoteExtractionSystemPrompt(),
          },
          {
            role: 'user',
            content: buildDoctorNoteExtractionUserPrompt(rawText),
          },
        ],
        doctorNoteExtractionJsonSchema,
        false,
      );
    this.logger.log(
      JSON.stringify({
        event: 'ai.extract-doctor-note.completed',
        mimeType: input.mimeType,
        title: result.title,
        diagnosesCount: result.diagnoses.length,
        medicationsCount: result.medications.length,
      }),
    );

    return result;
  }

  async extractDocumentText(input: {
    documentUrl: string;
    mimeType: string;
  }): Promise<string> {
    return this.extractRawText(input.documentUrl, input.mimeType);
  }

  async generateEmbeddings(input: string[]): Promise<number[][]> {
    return this.cometService.createEmbeddings(input);
  }

  async createAssistantAnswer(messages: {
    systemPrompt: string;
    userPrompt: string;
    history?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
  }): Promise<string> {
    const completion = await this.cometService.createTextCompletion([
      {
        role: 'system',
        content: messages.systemPrompt,
      },
      ...((messages.history ?? []).map((message) => ({
        role: message.role,
        content: message.content,
      })) as Array<{
        role: 'user' | 'assistant';
        content: string;
      }>),
      {
        role: 'user',
        content: messages.userPrompt,
      },
    ]);

    return completion.content;
  }

  async analyzeMealImage(input: {
    imageUrl: string;
    description?: string;
  }): Promise<MealImageAnalysisResult> {
    this.logger.log(
      JSON.stringify({
        event: 'ai.meal-image.started',
        imageUrl: input.imageUrl,
        hasDescription: Boolean(input.description?.trim()),
        descriptionLength: input.description?.trim().length ?? 0,
      }),
    );
    const result =
      await this.cometService.createStructuredOutput<MealImageAnalysisResult>(
        [
          {
            role: 'system',
            content: buildMealImageSystemPrompt(),
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: buildMealImageUserPrompt(input.description),
              },
              {
                type: 'image_url',
                image_url: {
                  url: this.preprocessImageUrl(input.imageUrl),
                },
              },
            ],
          },
        ],
        mealImageAnalysisJsonSchema,
        true,
      );
    this.logger.log(
      JSON.stringify({
        event: 'ai.meal-image.completed',
        imageUrl: input.imageUrl,
        title: result.title,
        confidence: result.confidence,
        detectedItems: result.detectedItems.length,
      }),
    );

    return result;
  }

  async analyzeMealFromDescription(
    description: string,
  ): Promise<MealImageAnalysisResult> {
    this.logger.log(
      JSON.stringify({
        event: 'ai.meal-description-fallback.started',
        descriptionLength: description.trim().length,
      }),
    );
    const result =
      await this.cometService.createStructuredOutput<MealImageAnalysisResult>(
        [
          {
            role: 'system',
            content: buildMealDescriptionFallbackSystemPrompt(),
          },
          {
            role: 'user',
            content: buildMealDescriptionFallbackUserPrompt(description),
          },
        ],
        mealImageAnalysisJsonSchema,
        false,
      );
    this.logger.log(
      JSON.stringify({
        event: 'ai.meal-description-fallback.completed',
        title: result.title,
        confidence: result.confidence,
        detectedItems: result.detectedItems.length,
      }),
    );

    return result;
  }

  async summarizeMealAnalyses(
    analyses: MealImageAnalysisResult[],
  ): Promise<MealAggregateAnalysisResult> {
    this.logger.log(
      JSON.stringify({
        event: 'ai.meal-aggregate.started',
        analysesCount: analyses.length,
      }),
    );
    const result =
      await this.cometService.createStructuredOutput<MealAggregateAnalysisResult>(
        [
          {
            role: 'system',
            content: buildMealAggregateSystemPrompt(),
          },
          {
            role: 'user',
            content: buildMealAggregateUserPrompt(
              JSON.stringify(analyses, null, 2),
            ),
          },
        ],
        mealAggregateAnalysisJsonSchema,
        false,
      );
    this.logger.log(
      JSON.stringify({
        event: 'ai.meal-aggregate.completed',
        analysesCount: analyses.length,
        title: result.title,
        confidence: result.confidence,
      }),
    );

    return result;
  }

  async generateFitnessPlan(input: {
    weekLabel: string;
    profile: string;
    context: string;
  }): Promise<FitnessWeeklyPlanResult> {
    return this.cometService.createStructuredOutput<FitnessWeeklyPlanResult>(
      [
        {
          role: 'system',
          content: buildFitnessPlanSystemPrompt(),
        },
        {
          role: 'user',
          content: buildFitnessPlanUserPrompt(input),
        },
      ],
      fitnessWeeklyPlanJsonSchema,
      false,
    );
  }

  async generateMealPlan(input: {
    weekLabel: string;
    profile: string;
    preferences?: string;
    context: string;
  }): Promise<MealWeeklyPlanResult> {
    return this.cometService.createStructuredOutput<MealWeeklyPlanResult>(
      [
        {
          role: 'system',
          content: buildMealPlanSystemPrompt(),
        },
        {
          role: 'user',
          content: buildMealPlanUserPrompt(input),
        },
      ],
      mealWeeklyPlanJsonSchema,
      false,
    );
  }

  async summarizeLabs(input: {
    profile: string;
    labs: string;
  }): Promise<string> {
    const completion = await this.cometService.createTextCompletion([
      {
        role: 'system',
        content: buildLabsSummarySystemPrompt(),
      },
      {
        role: 'user',
        content: buildLabsSummaryUserPrompt(input),
      },
    ]);

    return completion.content;
  }

  private async extractRawText(
    documentUrl: string,
    mimeType: string,
  ): Promise<string> {
    if (mimeType.includes('pdf')) {
      const response = await axios.get<ArrayBuffer>(documentUrl, {
        responseType: 'arraybuffer',
      });
      const pdf = await pdfParse(Buffer.from(response.data));
      const text = pdf.text.trim();

      if (text.length > 0) {
        return text;
      }
    }

    const completion = await this.cometService.createTextCompletion([
      {
        role: 'system',
        content: buildVisionOcrPrompt(),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Transcribe this medical document with high fidelity.',
          },
          {
            type: 'image_url',
            image_url: {
              url: this.preprocessImageUrl(documentUrl),
            },
          },
        ],
      },
    ]);

    return completion.content;
  }

  private preprocessImageUrl(documentUrl: string): string {
    if (!documentUrl.includes('/upload/')) {
      return documentUrl;
    }

    return documentUrl.replace('/upload/', '/upload/f_auto,q_auto,w_1800/');
  }
}
