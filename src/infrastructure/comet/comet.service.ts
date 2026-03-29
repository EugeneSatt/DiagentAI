import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface JsonSchemaFormat {
  name: string;
  schema: Record<string, unknown>;
}

interface CometCompletionResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type: string;
            text?: string;
          }>;
    };
  }>;
}

interface CometEmbeddingResponse {
  data?: Array<{
    embedding: number[];
  }>;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
}

interface GeminiTextPart {
  text: string;
}

interface GeminiInlineDataPart {
  inline_data: {
    mime_type: string;
    data: string;
  };
}

type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiGenerationConfig {
  responseMimeType?: string;
  responseJsonSchema?: Record<string, unknown>;
}

export interface CometChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
}

export interface AssistantCompletionResult {
  content: string;
  raw: unknown;
}

@Injectable()
export class CometService {
  private readonly logger = new Logger(CometService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.client = axios.create({
      baseURL: this.configService.getOrThrow<string>('comet.apiUrl'),
      timeout: this.configService.get<number>('comet.timeoutMs', 45_000),
      headers: {
        Authorization: `Bearer ${this.configService.getOrThrow<string>('comet.apiKey')}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async createStructuredOutput<T>(
    messages: CometChatMessage[],
    schema: JsonSchemaFormat,
    useVision = false,
  ): Promise<T> {
    const model = this.resolveModel(useVision);
    this.logger.log(
      JSON.stringify({
        event: 'comet.structured.started',
        model,
        useVision,
        schemaName: schema.name,
        messageCount: messages.length,
      }),
    );

    if (this.isGeminiNativeModel(model)) {
      return this.createGeminiStructuredOutput<T>(model, messages, schema);
    }

    try {
      const response = await this.client.post<CometCompletionResponse>(
        '/v1/chat/completions',
        {
          model,
          messages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: schema.name,
              schema: schema.schema,
              strict: true,
            },
          },
        },
      );

      const content = this.extractTextContent(response.data);
      this.logger.log(
        JSON.stringify({
          event: 'comet.structured.completed',
          model,
          useVision,
          schemaName: schema.name,
          responseLength: content.length,
        }),
      );
      return JSON.parse(content) as T;
    } catch (error) {
      this.logAxiosError('Comet structured completion failed', error);
      throw new BadGatewayException('AI extraction provider failed');
    }
  }

  async createTextCompletion(
    messages: CometChatMessage[],
  ): Promise<AssistantCompletionResult> {
    const model = this.resolveModel(false);
    this.logger.log(
      JSON.stringify({
        event: 'comet.text.started',
        model,
        messageCount: messages.length,
      }),
    );

    if (this.isGeminiNativeModel(model)) {
      return this.createGeminiTextCompletion(model, messages);
    }

    try {
      const response = await this.client.post<CometCompletionResponse>(
        '/v1/chat/completions',
        {
          model,
          messages,
        },
      );

      const content = this.extractTextContent(response.data);
      this.logger.log(
        JSON.stringify({
          event: 'comet.text.completed',
          model,
          responseLength: content.length,
        }),
      );
      return {
        content,
        raw: response.data,
      };
    } catch (error) {
      this.logAxiosError('Comet chat completion failed', error);
      throw new BadGatewayException('Assistant provider failed');
    }
  }

  async createEmbeddings(input: string[]): Promise<number[][]> {
    if (input.length === 0) {
      return [];
    }

    try {
      const response = await this.client.post<CometEmbeddingResponse>(
        '/v1/embeddings',
        {
          model: this.configService.get<string>('comet.embeddingModel'),
          input,
        },
      );

      return (response.data.data ?? []).map((item) => item.embedding);
    } catch (error) {
      this.logAxiosError('Comet embeddings failed', error);
      throw new BadGatewayException('Embedding provider failed');
    }
  }

  private extractTextContent(payload: CometCompletionResponse): string {
    const content = payload.choices?.[0]?.message?.content;

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .filter((item) => item.type === 'text')
        .map((item) => item.text ?? '')
        .join('\n')
        .trim();
    }

    throw new InternalServerErrorException('Invalid AI provider response');
  }

  private async createGeminiStructuredOutput<T>(
    model: string,
    messages: CometChatMessage[],
    schema: JsonSchemaFormat,
  ): Promise<T> {
    try {
      const response = await this.postGeminiGenerateContent(model, messages, {
        responseMimeType: 'application/json',
        responseJsonSchema: schema.schema,
      });

      const content = this.extractGeminiTextContent(response.data);
      this.logger.log(
        JSON.stringify({
          event: 'comet.gemini.structured.completed',
          model,
          schemaName: schema.name,
          responseLength: content.length,
        }),
      );
      try {
        return JSON.parse(content) as T;
      } catch (error) {
        this.logger.error(
          `Comet Gemini structured completion returned non-JSON for model ${model}: ${content.slice(
            0,
            500,
          )}`,
        );
        throw error;
      }
    } catch (error) {
      this.logAxiosError('Comet Gemini structured completion failed', error);
      throw new BadGatewayException('AI extraction provider failed');
    }
  }

  private async createGeminiTextCompletion(
    model: string,
    messages: CometChatMessage[],
  ): Promise<AssistantCompletionResult> {
    try {
      const response = await this.postGeminiGenerateContent(model, messages);
      const content = this.extractGeminiTextContent(response.data);
      this.logger.log(
        JSON.stringify({
          event: 'comet.gemini.text.completed',
          model,
          responseLength: content.length,
        }),
      );

      return {
        content,
        raw: response.data,
      };
    } catch (error) {
      this.logAxiosError('Comet Gemini chat completion failed', error);
      throw new BadGatewayException('Assistant provider failed');
    }
  }

  private async postGeminiGenerateContent(
    model: string,
    messages: CometChatMessage[],
    generationConfig?: GeminiGenerationConfig,
  ) {
    this.logger.log(
      JSON.stringify({
        event: 'comet.gemini.request.started',
        model,
        messageCount: messages.length,
        hasJsonSchema: Boolean(generationConfig?.responseJsonSchema),
        responseMimeType: generationConfig?.responseMimeType ?? null,
      }),
    );
    return axios.post<GeminiGenerateContentResponse>(
      `${this.configService.getOrThrow<string>('comet.apiUrl')}/v1beta/models/${model}:generateContent`,
      await this.buildGeminiRequestBody(messages, generationConfig),
      {
        timeout: this.configService.get<number>('comet.timeoutMs', 45_000),
        headers: {
          Authorization: this.configService.getOrThrow<string>('comet.apiKey'),
          'Content-Type': 'application/json',
        },
      },
    );
  }

  private async buildGeminiRequestBody(
    messages: CometChatMessage[],
    generationConfig?: GeminiGenerationConfig,
  ): Promise<{
    contents: GeminiContent[];
    system_instruction?: { parts: GeminiTextPart[] };
    generationConfig?: GeminiGenerationConfig;
  }> {
    const systemMessages = messages
      .filter((message) => message.role === 'system')
      .flatMap((message) => this.extractTextParts(message.content))
      .filter((text) => text.length > 0);

    const contents = await Promise.all(
      messages
        .filter((message) => message.role !== 'system')
        .map((message) => this.toGeminiContent(message)),
    );

    return {
      contents,
      system_instruction:
        systemMessages.length > 0
          ? {
              parts: systemMessages.map((text) => ({ text })),
            }
          : undefined,
      generationConfig,
    };
  }

  private extractTextParts(content: CometChatMessage['content']): string[] {
    if (typeof content === 'string') {
      return [content];
    }

    return content
      .filter(
        (part): part is { type: 'text'; text: string } => part.type === 'text',
      )
      .map((part) => part.text);
  }

  private async toGeminiContent(
    message: CometChatMessage,
  ): Promise<GeminiContent> {
    const parts =
      typeof message.content === 'string'
        ? [{ text: message.content }]
        : await Promise.all(
            message.content.map((part) => this.toGeminiPart(part)),
          );

    return {
      role: message.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  }

  private async toGeminiPart(
    part: Extract<CometChatMessage['content'], Array<unknown>>[number],
  ): Promise<GeminiPart> {
    if (part.type === 'text') {
      return {
        text: part.text,
      };
    }

    this.logger.log(
      JSON.stringify({
        event: 'comet.gemini.image-fetch.started',
        imageUrl: part.image_url.url,
      }),
    );
    const response = await axios.get<ArrayBuffer>(part.image_url.url, {
      responseType: 'arraybuffer',
      timeout: this.configService.get<number>('comet.timeoutMs', 45_000),
    });
    const headers = response.headers as Record<
      string,
      string | string[] | undefined
    >;
    const contentTypeHeader = headers['content-type'];
    const mimeType =
      this.getSingleHeaderValue(
        typeof contentTypeHeader === 'string' ||
          Array.isArray(contentTypeHeader)
          ? contentTypeHeader
          : undefined,
      ) ?? 'image/jpeg';

    this.logger.log(
      JSON.stringify({
        event: 'comet.gemini.image-fetch.completed',
        imageUrl: part.image_url.url,
        mimeType,
        bytes: Buffer.byteLength(Buffer.from(response.data)),
      }),
    );

    return {
      inline_data: {
        mime_type: mimeType,
        data: Buffer.from(response.data).toString('base64'),
      },
    };
  }

  private extractGeminiTextContent(
    payload: GeminiGenerateContentResponse,
  ): string {
    const text = (payload.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('\n')
      .trim();

    if (!text) {
      throw new InternalServerErrorException(
        'Invalid Gemini provider response',
      );
    }

    return text;
  }

  private isGeminiNativeModel(model: string): boolean {
    return model.startsWith('gemini-');
  }

  private resolveModel(useVision: boolean): string {
    return this.configService.getOrThrow<string>(
      useVision ? 'comet.visionModel' : 'comet.textModel',
    );
  }

  private getSingleHeaderValue(
    value: string | string[] | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    return Array.isArray(value) ? (value[0] ?? null) : value;
  }

  private logAxiosError(message: string, error: unknown): void {
    if (axios.isAxiosError<unknown>(error)) {
      this.logger.error(
        `${message}: ${JSON.stringify({
          code: error.code,
          status: error.response?.status,
          response: error.response?.data,
          message: error.message,
        })}`,
      );
      return;
    }

    this.logger.error(message, error);
  }
}
