import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';

// Exercises the REAL RolesGuard against the REAL @Roles metadata on
// AdminSubscriptionsController. This is a regression test for a real bug:
// @Roles(Role.SUPER_ADMIN) was previously listed AFTER @AdminController(...)
// in source, which silently overwrote it back to @AdminController's own
// internal ADMIN+SUPER_ADMIN default (decorators on one declaration apply
// bottom-to-top; verified with Reflect.getMetadata against the real class).
// A plain ADMIN could grant themselves Plus for free, extend it, or revoke
// another store's subscription — the exact opposite of "a shop owner can
// never grant/extend/revoke their own Plus, by construction" this
// controller's own doc comment claimed.
function contextFor(handlerName: keyof AdminSubscriptionsController, role: string | undefined): ExecutionContext {
  return {
    getHandler: () => AdminSubscriptionsController.prototype[handlerName],
    getClass:   () => AdminSubscriptionsController,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminSubscriptionsController — @Roles(Role.SUPER_ADMIN) enforcement', () => {
  const guard = new RolesGuard(new Reflector());
  const handlers = ['getSubscription', 'grant', 'extend', 'cancelRenewal', 'revoke'] as const;

  it.each(handlers)('blocks ADMIN on %s', (handler) => {
    expect(guard.canActivate(contextFor(handler, 'ADMIN'))).toBe(false);
  });

  it.each(handlers)('allows SUPER_ADMIN on %s', (handler) => {
    expect(guard.canActivate(contextFor(handler, 'SUPER_ADMIN'))).toBe(true);
  });
});
