import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SenderType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateConversationDto } from './dto/create-conversation.dto';
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
