import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MessagesService, ConversationView, ConversationDetailView, MessageView } from './messages.service';
import { StartConversationDto, SendMessageDto } from './dto/messages.dto';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  public constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List the current user conversations, most recently active first' })
  @ApiResponse({ status: 200, description: 'Conversation list' })
  public async listConversations(@CurrentUser() user: AuthenticatedUser): Promise<ConversationView[]> {
    return this.messagesService.listConversations(user.id);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Get or create the conversation with another user' })
  @ApiResponse({ status: 201, description: 'Conversation (existing or newly created)' })
  public async startConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartConversationDto,
  ): Promise<ConversationView> {
    return this.messagesService.getOrCreateConversation(user.id, dto.recipientId);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation with its paginated messages (oldest first)' })
  @ApiResponse({ status: 200, description: 'Conversation detail' })
  public async getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('page') page?: string,
  ): Promise<ConversationDetailView> {
    return this.messagesService.getMessages(user.id, id, page ? parseInt(page, 10) : 1);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ApiResponse({ status: 201, description: 'Sent message' })
  public async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageView> {
    return this.messagesService.sendMessage(user.id, id, dto);
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: 'Mark all messages in a conversation as read' })
  @ApiResponse({ status: 200, description: 'Marked as read' })
  public async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.messagesService.markRead(user.id, id);
  }
}
