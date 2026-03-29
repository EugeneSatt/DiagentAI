import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../../infrastructure/crypto/encryption.service';
import { AssistantListQueryDto } from '../dto/assistant-list-query.dto';
import { AssistantRepository } from '../repositories/assistant.repository';

@Injectable()
export class ListAssistantMessagesUseCase {
  constructor(
    private readonly assistantRepository: AssistantRepository,
    private readonly encryptionService: EncryptionService,
  ) {}

  async execute(
    userId: string,
    conversationId: string,
    query: AssistantListQueryDto,
  ) {
    const messages = await this.assistantRepository.getConversationMessages(
      userId,
      conversationId,
      query.limit ?? 20,
    );

    return {
      conversationId,
      messages: messages
        .slice()
        .reverse()
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: this.encryptionService.decrypt(message.contentEncrypted),
          citations: message.citations,
          createdAt: message.createdAt,
        })),
    };
  }
}
