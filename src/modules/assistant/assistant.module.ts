import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AssistantController } from './controllers/assistant.controller';
import { AssistantRepository } from './repositories/assistant.repository';
import { AssistantService } from './services/assistant.service';
import { GenerateAssistantResponseUseCase } from './use-cases/generate-assistant-response.use-case';
import { ListAssistantConversationsUseCase } from './use-cases/list-assistant-conversations.use-case';
import { ListAssistantMessagesUseCase } from './use-cases/list-assistant-messages.use-case';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [AssistantController],
  providers: [
    AssistantRepository,
    AssistantService,
    GenerateAssistantResponseUseCase,
    ListAssistantConversationsUseCase,
    ListAssistantMessagesUseCase,
  ],
})
export class AssistantModule {}
