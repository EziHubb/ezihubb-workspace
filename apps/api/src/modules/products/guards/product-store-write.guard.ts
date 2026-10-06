import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { StoreContextService } from '../../../common/services/store-context.service';

const PRODUCT_READ_OPERATION = 'productReadOperation';
/** Explicit exception for read-only POST endpoints such as CSV export. */
export const ProductReadOperation = () =>
  SetMetadata(PRODUCT_READ_OPERATION, true);

/** Platform can inspect products; writes require an explicitly selected owned store. */
@Injectable()
export class ProductStoreWriteGuard implements CanActivate {
  constructor(
    private readonly storeContext: StoreContextService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (
      this.reflector.get<boolean>(PRODUCT_READ_OPERATION, context.getHandler())
    )
      return true;
    const scope = await this.storeContext.resolve(req);
    if (scope.isPlatformContext || !scope.storeId) {
      throw new ForbiddenException({
        code: 'ERR_PRODUCTS_READ_ONLY',
        message:
          'Products are read-only in Platform mode. Switch to My Store to manage your own listings.',
      });
    }
    return true;
  }
}
