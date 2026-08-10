import {
  Body,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation } from '@nestjs/swagger';
import { SenderType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { AdminConversationQueryDto } from './dto/admin-conversation-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationStatusDto } from './dto/update-conversation-status.dto';
import { MessagesService } from './messages.service';
import { StoreContextService } from '../../common/services/store-context.service';

@AdminController('messages')
export class AdminMessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly storeContext: StoreContextService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations' })
  async listConversations(@Req() req: Request, @Query() query: AdminConversationQueryDto) {
    const context = await this.storeContext.resolve(req);
    return this.messagesService.adminListConversations(query, context.storeId ?? undefined);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  async getConversation(@Req() req: Request, @Param('id') id: string) {
    const context = await this.storeContext.resolve(req);
    return this.messagesService.adminGetConversation(id, context.storeId ?? undefined);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a reply from the shop' })
  async sendReply(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const context = await this.storeContext.resolve(req);
    return this.messagesService.sendMessage(id, SenderType.SHOP, user.sub, dto, context.storeId ?? undefined);
  }

  @Patch('conversations/:id/status')
  @ApiOperation({ summary: 'Update conversation status' })
  async updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateConversationStatusDto,
  ) {
    const context = await this.storeContext.resolve(req);
    return this.messagesService.adminUpdateStatus(id, dto.status, context.storeId ?? undefined);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read (admin)' })
  async markRead(@Req() req: Request, @Param('id') id: string) {
    const context = await this.storeContext.resolve(req);
    return this.messagesService.markAdminRead(id, context.storeId ?? undefined);
  }
}
