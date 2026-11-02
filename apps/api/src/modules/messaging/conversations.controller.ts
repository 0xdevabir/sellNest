import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, RateLimit, VerifiedOnly } from '../../common/auth.decorators';
import { CreateConversationDto, MessagesQueryDto, PaginationDto, SendMessageDto } from '../../common/dtos';
import { ConversationsService } from './conversations.service';

@ApiTags('messaging')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @VerifiedOnly()
  @RateLimit({ name: 'start-conversation', limit: 30, windowSeconds: 3600, by: 'user' })
  @Post()
  start(@CurrentUser() user: AuthUser, @Body() dto: CreateConversationDto) {
    return this.conversations.start(user, dto.listingId, dto.message);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    const { page, limit } = q as unknown as { page: number; limit: number };
    return this.conversations.list(user.id, page, limit);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.get(id, user.id);
  }

  @Get(':id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() q: MessagesQueryDto) {
    const { before, limit } = q as unknown as { before?: string; limit: number };
    return this.conversations.messages(id, user.id, before, limit);
  }

  @VerifiedOnly()
  @RateLimit({ name: 'send-message', limit: 30, windowSeconds: 60, by: 'user' })
  @Post(':id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
    return this.conversations.send(user, id, dto.body);
  }

  @HttpCode(204)
  @RateLimit({ name: 'read-conversation', limit: 240, windowSeconds: 60, by: 'user' })
  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.markRead(id, user.id);
  }
}
