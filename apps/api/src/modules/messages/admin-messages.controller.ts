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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { SenderType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { AdminConversationQueryDto } from './dto/admin-conversation-query.dto';
import { ConversationWithUserDto } from './dto/conversation-with-user.dto';
import { LinkPreviewQueryDto } from './dto/link-preview-query.dto';
import { MessagePageQueryDto } from './dto/message-page-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationStatusDto } from './dto/update-conversation-status.dto';
import { MAX_MESSAGE_ATTACHMENTS, MESSAGE_ATTACHMENT_MAX_BYTES, MessagesService } from './messages.service';
import { LinkPreviewService } from './link-preview.service';
import { InboxService } from './inbox.service';
import { SnippetsService } from './snippets.service';
import {
  BulkConversationDto,
  CreateLabelDto,
  SetAutoReplyDto,
  SetBuyerNoteDto,
  SetConversationLabelsDto,
  SnippetDto,
} from './dto/inbox.dto';
import { StoreContextService } from '../../common/services/store-context.service';

@AdminController('messages')
export class AdminMessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly inbox:          InboxService,
    private readonly snippets:       SnippetsService,
    private readonly storeContext:   StoreContextService,
    private readonly linkPreviews:   LinkPreviewService,
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

  /** Older messages, a page at a time — see the buyer-side twin for why. */
  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Page backwards through a conversation' })
  async getMessagePage(
    @Req() req: Request,
    @Param('id') id: string,
    @Query() query: MessagePageQueryDto,
  ) {
    const context = await this.storeContext.resolve(req);
    return this.messagesService.getMessagePage(id, query, {
      storeId: context.storeId ?? undefined,
      forShop: true,
    });
  }

  /** The shop's twin of the buyer-side upload — same service, same limits. */
  @Post('conversations/:id/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_MESSAGE_ATTACHMENTS, {
    storage: memoryStorage(),
    limits:  { fileSize: MESSAGE_ATTACHMENT_MAX_BYTES },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiOperation({ summary: 'Upload files to attach to a reply (images/PDF, max 10 MB each)' })
  async uploadAttachments(
    @Req() req: Request,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const context = await this.storeContext.resolve(req);
    return this.messagesService.uploadAttachments(id, files, {
      storeId: context.storeId ?? undefined,
      forShop: true,
    });
  }

  /** Unfurls a link sent in this thread. See LinkPreviewService for why the
   *  conversation id is part of the request and not decoration. */
  @Get('conversations/:id/link-preview')
  @ApiOperation({ summary: 'Preview card for a link sent in this conversation' })
  async linkPreview(
    @Req() req: Request,
    @Param('id') id: string,
    @Query() query: LinkPreviewQueryDto,
  ) {
    const context = await this.storeContext.resolve(req);
    return this.linkPreviews.previewFor(id, query.url, {
      storeId: context.storeId ?? undefined,
      forShop: true,
    });
  }

  @Post('conversations/with-user')
  @ApiOperation({ summary: "Open (or reopen) the current seat's thread with a customer" })
  async conversationWithUser(
    @Req() req: Request,
    @Body() dto: ConversationWithUserDto,
  ) {
    const context = await this.storeContext.resolve(req);
    if (context.storeId) {
      return this.messagesService.findOrCreateStoreConversation(context.storeId, dto.userId);
    }

    // No active store means this is the platform support seat. The client
    // switches into "My Store" before a customer-list action, but preserve
    // the platform inbox's existing direct-open behaviour for its own tools.
    return this.messagesService.findOrCreatePlatformConversation(dto.userId);
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

  /**
   * Declared before any `conversations/:id/...` route would be a problem only
   * if it shared their shape — it does not, the segment is `messages`. Kept
   * beside the conversation routes rather than under one, because a message
   * id is enough to find its thread and nesting it would let the two
   * disagree.
   */
  @Delete('messages/:messageId')
  @ApiOperation({ summary: "Unsend one of the shop's own messages" })
  async deleteMessage(
    @Req() req: Request,
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const context = await this.storeContext.resolve(req);
    return this.messagesService.deleteMessage(messageId, user.sub, context.storeId ?? undefined);
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

  // ── Snippets ───────────────────────────────────────────────────────────────
  // Saved message bodies the seller inserts by hand. Not the away-message
  // above: nothing here ever sends itself.

  @Get('snippets')
  @ApiOperation({ summary: "A shop's saved message bodies" })
  async listSnippets(@Req() req: Request, @Query('storeId') storeId?: string) {
    return this.snippets.list(await this.storeFor(req, storeId));
  }

  @Post('snippets')
  @ApiOperation({ summary: 'Save a new snippet' })
  async createSnippet(@Req() req: Request, @Body() dto: SnippetDto, @Query('storeId') storeId?: string) {
    return this.snippets.create(await this.storeFor(req, storeId), dto.title, dto.body);
  }

  @Patch('snippets/:snippetId')
  @ApiOperation({ summary: 'Rename or rewrite a snippet' })
  async updateSnippet(
    @Req() req: Request,
    @Param('snippetId') snippetId: string,
    @Body() dto: SnippetDto,
    @Query('storeId') storeId?: string,
  ) {
    return this.snippets.update(await this.storeFor(req, storeId), snippetId, dto.title, dto.body);
  }

  @Delete('snippets/:snippetId')
  @ApiOperation({ summary: 'Delete a snippet' })
  async deleteSnippet(
    @Req() req: Request,
    @Param('snippetId') snippetId: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.snippets.remove(await this.storeFor(req, storeId), snippetId);
  }
}
