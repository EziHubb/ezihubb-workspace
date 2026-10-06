import 'reflect-metadata';
import type {} from 'passport';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { StoreContextService } from '../../../common/services/store-context.service';
import { ProductOwnershipGuard } from '../../../common/guards/product-ownership.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ProductReadOperation,
  ProductStoreWriteGuard,
} from './product-store-write.guard';

function requestContext(
  method: string,
  role = 'SUPER_ADMIN',
  selectedStore?: string,
  handler = () => undefined,
) {
  const req = {
    method,
    user: { sub: 'owner', role, storeId: 'own-store' },
    headers: selectedStore ? { 'x-store-context': selectedStore } : {},
    params: { id: 'product-1' },
  } as unknown as Request;
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
  } as unknown as ExecutionContext;
  return { req, context };
}

describe('Product write access by store context', () => {
  const prisma = { product: { findUnique: jest.fn() } };
  const scope = new StoreContextService(prisma as unknown as PrismaService);
  const guard = new ProductStoreWriteGuard(scope, new Reflector());
  const ownership = new ProductOwnershipGuard(
    prisma as unknown as PrismaService,
    scope,
  );

  beforeEach(() => jest.clearAllMocks());

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'allows platform read method %s',
    async (method) => {
      await expect(
        guard.canActivate(requestContext(method).context),
      ).resolves.toBe(true);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'blocks platform %s even when the user owns a store',
    async (method) => {
      await expect(
        guard.canActivate(requestContext(method).context),
      ).rejects.toThrow(ForbiddenException);
    },
  );

  it('blocks draft/bulk writes without an id param', async () => {
    const { context, req } = requestContext('POST');
    req.params = {};
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Products are read-only',
    );
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'allows %s after switching to the owned store',
    async (method) => {
      await expect(
        guard.canActivate(
          requestContext(method, 'SUPER_ADMIN', 'own-store').context,
        ),
      ).resolves.toBe(true);
    },
  );

  it('allows a regular shop owner without a context header', async () => {
    await expect(
      guard.canActivate(requestContext('POST', 'ADMIN').context),
    ).resolves.toBe(true);
  });

  it('rejects forged context headers naming another shop', async () => {
    await expect(
      guard.canActivate(
        requestContext('POST', 'SUPER_ADMIN', 'other-store').context,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('still rejects modifying another shop product while in My Store', async () => {
    prisma.product.findUnique.mockResolvedValue({ storeId: 'other-store' });
    const { context } = requestContext('PATCH', 'SUPER_ADMIN', 'own-store');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(ownership.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows an explicitly declared read-only POST operation', async () => {
    class ExportController {
      @ProductReadOperation()
      exportCsv() {
        return undefined;
      }
    }
    await expect(
      guard.canActivate(
        requestContext(
          'POST',
          'SUPER_ADMIN',
          undefined,
          ExportController.prototype.exportCsv,
        ).context,
      ),
    ).resolves.toBe(true);
  });
});
