import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SenderType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { MessagePageQueryDto } from './dto/message-page-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('conversations')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Start a new support conversation' })
  async createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    return this.messagesService.createConversation(user?.sub ?? null, dto);
  }

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List my conversations' })
  async getMyConversations(@CurrentUser() user: JwtPayload) {
    return this.messagesService.getMyConversations(user.sub);
  }

  @Get('conversations/:id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get a conversation with messages' })
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    return this.messagesService.getConversation(id, user?.sub ?? null);
  }

  /**
   * Older messages, a page at a time.
   *
   * The conversation endpoint returns the newest window and a flag saying
   * whether anything lies behind it. This is how the reader walks back — the
   * thread is a whole relationship with a shop now, not one order, so loading
   * all of it on open is not an option.
   */
  @Get('conversations/:id/messages')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Page backwards through a conversation' })
  async getMessagePage(
    @Param('id') id: string,
    @Query() query: MessagePageQueryDto,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    return this.messagesService.getMessagePage(id, query, {
      userId:  user?.sub ?? null,
      forShop: false,
    });
  }

  @Post('conversations/:id/messages')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Send a message in a conversation' })
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    return this.messagesService.sendMessage(id, SenderType.CUSTOMER, user?.sub ?? null, dto);
  }

  @Post('conversations/:id/read')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark conversation as read (customer)' })
  async markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.messagesService.getConversation(id, user.sub);
    return this.messagesService.markCustomerRead(id);
  }
}
