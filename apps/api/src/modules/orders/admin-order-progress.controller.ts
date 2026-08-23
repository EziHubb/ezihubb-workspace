import { Body, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { OrderProgressService } from './order-progress.service';
import {
  MoveOrdersToStepDto,
  SaveProgressStepsDto,
  SetGiftDto,
  SetShipByDateDto,
} from './dto/order-progress.dto';
import { OrderQueueQueryDto } from './dto/order-queue.dto';
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
    private readonly progress:     OrderProgressService,
    private readonly storeContext: StoreContextService,
    private readonly auditLog:     AuditLogService,
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
