import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../../infrastructure/crypto/encryption.service';
import { AssistantListQueryDto } from '../dto/assistant-list-query.dto';
import { AssistantRepository } from '../repositories/assistant.repository';

@Injectable()
export class ListAssistantConversationsUseCase {
  constructor(
    private readonly assistantRepository: AssistantRepository,
    private readonly encryptionService: EncryptionService,
  ) {}

  async execute(userId: string, query: AssistantListQueryDto) {
    const conversations = await this.assistantRepository.listConversations(
      userId,
      query.limit ?? 20,
    );

    return conversations.map((conversation) => {
      const latestMessage = conversation.messages[0];

      return {
        id: conversation.id,
        title: conversation.title ?? 'Новый чат',
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        latestMessage: latestMessage
          ? {
              id: latestMessage.id,
              role: latestMessage.role,
              content: this.encryptionService.decrypt(
                latestMessage.contentEncrypted,
              ),
              createdAt: latestMessage.createdAt,
            }
          : null,
      };
    });
  }
}
