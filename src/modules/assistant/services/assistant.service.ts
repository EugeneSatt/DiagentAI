import { Injectable } from '@nestjs/common';
import { AssistantListQueryDto } from '../dto/assistant-list-query.dto';
import { AssistantMessageDto } from '../dto/assistant-message.dto';
import { GenerateAssistantResponseUseCase } from '../use-cases/generate-assistant-response.use-case';
import { ListAssistantConversationsUseCase } from '../use-cases/list-assistant-conversations.use-case';
import { ListAssistantMessagesUseCase } from '../use-cases/list-assistant-messages.use-case';

@Injectable()
export class AssistantService {
  constructor(
    private readonly generateAssistantResponseUseCase: GenerateAssistantResponseUseCase,
    private readonly listAssistantConversationsUseCase: ListAssistantConversationsUseCase,
    private readonly listAssistantMessagesUseCase: ListAssistantMessagesUseCase,
  ) {}

  message(userId: string, dto: AssistantMessageDto) {
    return this.generateAssistantResponseUseCase.execute(userId, dto);
  }

  listConversations(userId: string, query: AssistantListQueryDto) {
    return this.listAssistantConversationsUseCase.execute(userId, query);
  }

  listMessages(
    userId: string,
    conversationId: string,
    query: AssistantListQueryDto,
  ) {
    return this.listAssistantMessagesUseCase.execute(
      userId,
      conversationId,
      query,
    );
  }
}
