import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreContextService } from '../services/store-context.service';

/**
 * Closes the IDOR gap on every `/admin/orders/:id/...` route: a plain ADMIN
 * shop owner could previously read/update/cancel/ship/label ANY order on the
 * platform just by knowing its id. An `Order` can span multiple stores (one
 * `StoreOrder` per vendor), so "owns this order" means "is one of its
 * vendors" — a `StoreOrder` row exists for (orderId, callerStoreId).
 * No-ops for platform-context SUPER_ADMIN and for routes with no order id.
 */
@Injectable()
export class OrderOwnershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeContext: StoreContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const orderId = (req.params as Record<string, string>)['id'];
    if (!orderId) return true;

    const storeContext = await this.storeContext.resolve(req);
    if (storeContext.isPlatformContext) return true;

    const storeOrder = await this.prisma.storeOrder.findFirst({
      where: { orderId, storeId: storeContext.storeId! },
      select: { id: true },
    });
    if (!storeOrder) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });
    return true;
  }
}
