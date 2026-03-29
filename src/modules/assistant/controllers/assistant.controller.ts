import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtPayload } from '../../../domain/auth/jwt-payload.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { AssistantListQueryDto } from '../dto/assistant-list-query.dto';
import { AssistantMessageDto } from '../dto/assistant-message.dto';
import { AssistantService } from '../services/assistant.service';

@Controller({
  path: 'assistant',
  version: '1',
})
@UseGuards(AccessTokenGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('conversations')
  listConversations(
    @CurrentUser() user: JwtPayload,
    @Query() query: AssistantListQueryDto,
  ) {
    return this.assistantService.listConversations(user.sub, query);
  }

  @Get('conversations/:conversationId/messages')
  listMessages(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Query() query: AssistantListQueryDto,
  ) {
    return this.assistantService.listMessages(user.sub, conversationId, query);
  }

  @Post('message')
  message(@CurrentUser() user: JwtPayload, @Body() dto: AssistantMessageDto) {
    return this.assistantService.message(user.sub, dto);
  }
}
