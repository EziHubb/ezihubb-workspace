import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminPlatformSettingsController } from './admin-stores.controller';

// Exercises the REAL RolesGuard against the REAL @Roles metadata on
// AdminPlatformSettingsController. Regression test for the same
// decorator-order bug fixed on AdminSubscriptionsController and
// AdminEmailTemplatesController in the same pass: @Roles(Role.SUPER_ADMIN)
// listed AFTER @AdminController(...) in source was silently overwritten by
// @AdminController's own internal ADMIN+SUPER_ADMIN default (verified via
// Reflect.getMetadata against the real class) — meaning any plain ADMIN
// could previously PATCH platform-wide fee rates, payout thresholds, and
// the Ezihubb Plus list price.
function contextFor(handlerName: keyof AdminPlatformSettingsController, role: string | undefined): ExecutionContext {
  return {
    getHandler: () => AdminPlatformSettingsController.prototype[handlerName],
    getClass:   () => AdminPlatformSettingsController,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminPlatformSettingsController — @Roles(Role.SUPER_ADMIN) enforcement', () => {
  const guard = new RolesGuard(new Reflector());

  it.each(['getSettings', 'updateSettings'] as const)('blocks ADMIN on %s', (handler) => {
    expect(guard.canActivate(contextFor(handler, 'ADMIN'))).toBe(false);
  });

  it.each(['getSettings', 'updateSettings'] as const)('allows SUPER_ADMIN on %s', (handler) => {
    expect(guard.canActivate(contextFor(handler, 'SUPER_ADMIN'))).toBe(true);
  });
});
