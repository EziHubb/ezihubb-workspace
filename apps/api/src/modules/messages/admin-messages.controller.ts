import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { InboxService } from './inbox.service';
import {
  BulkConversationDto,
  CreateLabelDto,
  SetAutoReplyDto,
  SetBuyerNoteDto,
  SetConversationLabelsDto,
} from './dto/inbox.dto';
import { StoreContextService } from '../../common/services/store-context.service';

@AdminController('messages')
export class AdminMessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly inbox:          InboxService,
    private readonly storeContext:   StoreContextService,
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

  // ── Inbox ────────────────────────────────────────────────────────────────
  //
  // The list and detail routes above tolerate a platform-wide SUPER_ADMIN with
  // no store: reading every shop's threads is a support job. Everything below
  // writes something a shop owns — its labels, its notes, its away-message —
  // so a store has to be named.

  private async storeFor(req: Request, requestedStoreId?: string): Promise<string> {
    const context = await this.storeContext.resolve(req);
    return this.storeContext.resolveTargetStoreId(context, requestedStoreId);
  }

  @Get('folders')
  @ApiOperation({ summary: 'Conversation counts per inbox folder' })
  async folderCounts(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    return this.messagesService.adminFolderCounts(context.storeId ?? undefined);
  }

  @Post('conversations/bulk')
  @ApiOperation({ summary: 'Star, file or change the read state of several threads' })
  async bulk(@Req() req: Request, @Body() dto: BulkConversationDto, @Query('storeId') storeId?: string) {
    return this.inbox.bulk(await this.storeFor(req, storeId), dto.conversationIds, dto.action);
  }

  @Get('labels')
  @ApiOperation({ summary: "A shop's conversation labels" })
  async listLabels(@Req() req: Request, @Query('storeId') storeId?: string) {
    return this.inbox.listLabels(await this.storeFor(req, storeId));
  }

  @Post('labels')
  @ApiOperation({ summary: 'Create a label' })
  async createLabel(@Req() req: Request, @Body() dto: CreateLabelDto, @Query('storeId') storeId?: string) {
    return this.inbox.createLabel(await this.storeFor(req, storeId), dto.name, dto.color ?? 'muted');
  }

  @Patch('labels/:labelId')
  @ApiOperation({ summary: 'Rename or recolour a label' })
  async renameLabel(
    @Req() req: Request,
    @Param('labelId') labelId: string,
    @Body() dto: CreateLabelDto,
    @Query('storeId') storeId?: string,
  ) {
    return this.inbox.renameLabel(await this.storeFor(req, storeId), labelId, dto.name, dto.color);
  }

  @Delete('labels/:labelId')
  @ApiOperation({ summary: 'Delete a label and remove it from every thread' })
  async deleteLabel(@Req() req: Request, @Param('labelId') labelId: string, @Query('storeId') storeId?: string) {
    return this.inbox.deleteLabel(await this.storeFor(req, storeId), labelId);
  }

  @Put('conversations/:id/labels')
  @ApiOperation({ summary: "Replace a thread's labels" })
  async setLabels(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SetConversationLabelsDto,
    @Query('storeId') storeId?: string,
  ) {
    return this.inbox.setConversationLabels(await this.storeFor(req, storeId), id, dto.labelIds);
  }

  @Get('conversations/:id/buyer')
  @ApiOperation({ summary: 'Private note and history for the buyer on this thread' })
  async getBuyer(@Req() req: Request, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.inbox.buyerPanel(await this.storeFor(req, storeId), id);
  }

  @Put('conversations/:id/buyer/note')
  @ApiOperation({ summary: 'Write or clear the private note about this buyer' })
  async setBuyerNote(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SetBuyerNoteDto,
    @Query('storeId') storeId?: string,
  ) {
    return this.inbox.setBuyerNoteForConversation(await this.storeFor(req, storeId), id, dto.body);
  }

  @Get('auto-reply')
  @ApiOperation({ summary: "The shop's temporary away-message" })
  async getAutoReply(@Req() req: Request, @Query('storeId') storeId?: string) {
    return this.inbox.getAutoReply(await this.storeFor(req, storeId));
  }

  @Put('auto-reply')
  @ApiOperation({ summary: 'Turn the away-message on until a date, or off' })
  async setAutoReply(@Req() req: Request, @Body() dto: SetAutoReplyDto, @Query('storeId') storeId?: string) {
    const target = await this.storeFor(req, storeId);
    // `enabled: false` wins over any date sent with it, so turning it off
    // never depends on the client also clearing the date.
    const until = dto.enabled === false || !dto.activeUntil ? null : new Date(dto.activeUntil);
    return this.inbox.setAutoReply(target, dto.message, until);
  }
}
