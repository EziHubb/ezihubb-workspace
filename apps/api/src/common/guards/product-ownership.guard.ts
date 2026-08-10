import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreContextService } from '../services/store-context.service';

/**
 * Closes the IDOR gap on every `/admin/products/:id/...` (and
 * `/admin/stats/listings/:productId`) route: without this, a plain ADMIN
 * shop owner could read/edit/delete another store's product just by knowing
 * its id, since none of those handlers checked ownership themselves.
 * No-ops for routes with no product id param (e.g. `stats`, `export`, `bulk`
 * — those are scoped separately) and for platform-context SUPER_ADMIN.
 */
@Injectable()
export class ProductOwnershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeContext: StoreContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const productId = (req.params as Record<string, string>)['id'] ?? (req.params as Record<string, string>)['productId'];
    if (!productId) return true;

    const storeContext = await this.storeContext.resolve(req);
    if (storeContext.isPlatformContext) return true;

    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { storeId: true } });
    if (!product) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
    if (product.storeId !== storeContext.storeId) {
      throw new ForbiddenException({ code: 'ERR_FORBIDDEN', message: 'You do not have access to this product' });
    }
    return true;
  }
}
