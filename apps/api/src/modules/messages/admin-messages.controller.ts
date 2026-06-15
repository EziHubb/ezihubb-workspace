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
import { PrismaService } from '../../prisma/prisma.service';

interface JwtLike { sub?: string; id?: string; role?: string }

async function resolveSellerStoreId(prisma: PrismaService, user: JwtLike): Promise<string | null> {
  if (user.role === 'SUPER_ADMIN') return null;
  const userId = user.sub ?? user.id;
  if (!userId) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { storeId: true } });
  return dbUser?.storeId ?? null;
}

@AdminController('messages')
export class AdminMessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations' })
  async listConversations(@Req() req: Request, @Query() query: AdminConversationQueryDto) {
    const storeId = await resolveSellerStoreId(this.prisma, req.user as JwtLike);
    return this.messagesService.adminListConversations(query, storeId ?? undefined);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  async getConversation(@Param('id') id: string) {
    return this.messagesService.adminGetConversation(id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a reply from the shop' })
  async sendReply(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.sendMessage(id, SenderType.SHOP, user.sub, dto);
  }

  @Patch('conversations/:id/status')
  @ApiOperation({ summary: 'Update conversation status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateConversationStatusDto,
  ) {
    return this.messagesService.adminUpdateStatus(id, dto.status);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read (admin)' })
  async markRead(@Param('id') id: string) {
    return this.messagesService.markAdminRead(id);
  }
}
