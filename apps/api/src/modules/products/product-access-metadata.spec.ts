import 'reflect-metadata';
import type {} from 'passport';
import { ExecutionContext, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AdminProductsController } from './admin-products.controller';
import { CsvImportController } from './csv-import.controller';
import { SellerProductsController } from './seller-products.controller';
import { ProductStoreWriteGuard } from './guards/product-store-write.guard';
import { StoreContextService } from '../../common/services/store-context.service';

describe('Product controller read-only policy wiring', () => {
  const reflector = new Reflector();
  const scope = {
    resolve: jest
      .fn()
      .mockResolvedValue({ isPlatformContext: true, storeId: null }),
  };
  const guard = new ProductStoreWriteGuard(
    scope as unknown as StoreContextService,
    reflector,
  );
  const controllers = [
    AdminProductsController,
    CsvImportController,
    SellerProductsController,
  ];

  it.each(controllers)(
    '%p authenticates before enforcing product write access',
    (controller) => {
      const guards = reflector.get<Array<{ name: string }>>(
        GUARDS_METADATA,
        controller,
      );
      const names = guards.map((value) => value.name);
      expect(names).toContain('ProductStoreWriteGuard');
      expect(names.indexOf('JwtAuthGuard')).toBeLessThan(
        names.indexOf('ProductStoreWriteGuard'),
      );
    },
  );

  for (const controller of controllers) {
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = (
        controller.prototype as unknown as Record<string, () => unknown>
      )[name];
      const method = reflector.get<RequestMethod | undefined>(
        METHOD_METADATA,
        handler,
      );
      if (method === undefined || method === RequestMethod.GET) continue;
      it(`${controller.name}.${name} ${name === 'exportCsv' ? 'allows read-only export' : 'blocks platform writes'}`, async () => {
        const context = {
          switchToHttp: () => ({
            getRequest: () => ({ method: RequestMethod[method] }),
          }),
          getHandler: () => handler,
        } as unknown as ExecutionContext;
        if (name === 'exportCsv')
          await expect(guard.canActivate(context)).resolves.toBe(true);
        else
          await expect(guard.canActivate(context)).rejects.toThrow(
            'Products are read-only',
          );
      });
    }
  }
});
