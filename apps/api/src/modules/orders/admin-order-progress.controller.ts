import { Body, Get, Param, Patch, Post, Put, Query, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { OrderProgressService } from './order-progress.service';
import {
  MoveOrdersToStepDto,
  SaveProgressStepsDto,
  SetGiftDto,
  SetShipByDateDto,
} from './dto/order-progress.dto';
import { OrderQueueQueryDto } from './dto/order-queue.dto';
import { SendOrderMessageDto, SetPrivateNoteDto } from './dto/order-detail-panel.dto';
import { ATTACHMENT_MAX_BYTES, MAX_ATTACHMENTS_PER_MESSAGE, SellerOrderDetailService } from './seller-order-detail.service';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoreContextService } from '../../common/services/store-context.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

/**
 * A shop's order workflow.
 *
 * Every route resolves a store first. A shop owner only ever gets their own —
 * `resolveTargetStoreId` ignores what they ask for — while a SUPER_ADMIN in
 * platform context must name one, because a pipeline belongs to a shop and
 * merging several shops' steps into one set of tabs would mean nothing.
 */
@AdminController('order-progress')
export class AdminOrderProgressController {
  constructor(
    private readonly progress:      OrderProgressService,
    private readonly detailService: SellerOrderDetailService,
    private readonly storeContext:  StoreContextService,
    private readonly auditLog:      AuditLogService,
  ) {}

  private async storeFor(req: Request, requestedStoreId?: string): Promise<string> {
    const context = await this.storeContext.resolve(req);
    return this.storeContext.resolveTargetStoreId(context, requestedStoreId);
  }

  @Get('steps')
  @ApiOperation({ summary: "List a shop's workflow steps with the order count on each" })
  @ApiQuery({ name: 'storeId', required: false, description: 'SUPER_ADMIN only; ignored for shop owners' })
  async listSteps(@Req() req: Request, @Query('storeId') storeId?: string) {
    return this.progress.listStepsWithCounts(await this.storeFor(req, storeId));
  }

  @Put('steps')
  @ApiOperation({ summary: "Replace a shop's custom steps (the editor's Save)" })
  async saveSteps(
    @Req() req: Request,
    @Body() dto: SaveProgressStepsDto,
    @CurrentUser() user: JwtPayload,
    @Query('storeId') storeId?: string,
  ) {
    const target = await this.storeFor(req, storeId);
    const steps  = await this.progress.saveSteps(target, dto.steps);

    // Worth an audit line: this reshapes how every order in the shop is
    // filed, and a deleted step moves its orders back to the start.
    this.auditLog.log({
      userId:     user.sub,
      action:     'SAVE_PROGRESS_STEPS',
      entityType: 'Store',
      entityId:   target,
      after:      { steps: steps.map((s) => ({ id: s.id, name: s.name, sortOrder: s.sortOrder })) },
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });

    return steps;
  }

  @Get('orders')
  @ApiOperation({ summary: "A shop's work queue — one row per store order, in dispatch order" })
  async queue(@Req() req: Request, @Query() query: OrderQueueQueryDto) {
    return this.progress.listQueue(await this.storeFor(req, query.storeId), query);
  }

  @Get('destinations')
  @ApiOperation({ summary: 'Countries present in the queue, for the destination filter' })
  async destinations(@Req() req: Request, @Query('storeId') storeId?: string) {
    return this.progress.listDestinations(await this.storeFor(req, storeId));
  }

  // ── Order detail panel ─────────────────────────────────────────────────────
  // Nested under `orders/` rather than sharing the bare `:storeOrderId` prefix
  // the gift and ship-by routes use, so a detail path can never be matched by
  // one of those or the other way round.

  @Get('orders/:storeOrderId')
  @ApiOperation({ summary: "One store order in full — the detail panel's Order details tab" })
  async detail(
    @Req() req: Request,
    @Param('storeOrderId') storeOrderId: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.detailService.getDetail(await this.storeFor(req, storeId), storeOrderId);
  }

  @Get('orders/:storeOrderId/earnings')
  @ApiOperation({ summary: "What this shop earned on this order, from its own ledger" })
  async earnings(
    @Req() req: Request,
    @Param('storeOrderId') storeOrderId: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.detailService.getEarnings(await this.storeFor(req, storeId), storeOrderId);
  }

  @Get('orders/:storeOrderId/messages')
  @ApiOperation({ summary: 'The thread about this order, as shown inside the panel' })
  async thread(
    @Req() req: Request,
    @Param('storeOrderId') storeOrderId: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.detailService.getThread(await this.storeFor(req, storeId), storeOrderId);
  }

  @Post('orders/:storeOrderId/messages')
  @ApiOperation({ summary: 'Message the buyer about this order, opening the thread if needed' })
  async sendMessage(
    @Req() req: Request,
    @Param('storeOrderId') storeOrderId: string,
    @Body() dto: SendOrderMessageDto,
    @CurrentUser() user: JwtPayload,
    @Query('storeId') storeId?: string,
  ) {
    return this.detailService.sendMessage(
      await this.storeFor(req, storeId),
      storeOrderId,
      user.sub,
      dto.body,
      dto.attachmentUrls ?? [],
      dto.clientMessageId,
    );
  }

  @Post('orders/:storeOrderId/attachments')
  // `limits.fileSize` matters as much as the service's own size check: without
  // it multer buffers the entire upload into memory first and the check only
  // runs once it is already there, so a large file costs the RAM regardless of
  // being rejected. With it, multer aborts mid-stream.
  @UseInterceptors(FilesInterceptor('files', MAX_ATTACHMENTS_PER_MESSAGE, {
    storage: memoryStorage(),
    limits:  { fileSize: ATTACHMENT_MAX_BYTES },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiOperation({ summary: 'Upload files to attach to a message about this order (JPEG/PNG/WebP, max 10 MB each)' })
  async uploadAttachments(
    @Req() req: Request,
    @Param('storeOrderId') storeOrderId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('storeId') storeId?: string,
  ) {
    return this.detailService.uploadAttachments(
      await this.storeFor(req, storeId),
      storeOrderId,
      files,
    );
  }

  @Patch('orders/:storeOrderId/note')
  @ApiOperation({ summary: "The seller's private note on this order — never shown to the buyer" })
  async setPrivateNote(
    @Req() req: Request,
    @Param('storeOrderId') storeOrderId: string,
    @Body() dto: SetPrivateNoteDto,
    @Query('storeId') storeId?: string,
  ) {
    return this.detailService.setPrivateNote(
      await this.storeFor(req, storeId),
      storeOrderId,
      dto.note ?? null,
    );
  }

  @Post('move')
  @ApiOperation({ summary: 'Move one or more orders to a step' })
  async move(
    @Req() req: Request,
    @Body() dto: MoveOrdersToStepDto,
    @Query('storeId') storeId?: string,
  ) {
    return this.progress.moveOrders(await this.storeFor(req, storeId), dto.storeOrderIds, dto.stepId);
  }

  @Patch(':storeOrderId/gift')
  @ApiOperation({ summary: 'Mark or unmark an order as a gift' })
  async setGift(
    @Req() req: Request,
    @Param('storeOrderId') storeOrderId: string,
    @Body() dto: SetGiftDto,
    @Query('storeId') storeId?: string,
  ) {
    return this.progress.setGift(await this.storeFor(req, storeId), storeOrderId, dto.isGift);
  }

  @Patch(':storeOrderId/ship-by-date')
  @ApiOperation({ summary: 'Set or clear the dispatch promise on one order' })
  async setShipByDate(
    @Req() req: Request,
    @Param('storeOrderId') storeOrderId: string,
    @Body() dto: SetShipByDateDto,
    @Query('storeId') storeId?: string,
  ) {
    const target = await this.storeFor(req, storeId);
    return this.progress.setShipByDate(
      target,
      storeOrderId,
      dto.shipByDate ? new Date(dto.shipByDate) : null,
    );
  }
}
