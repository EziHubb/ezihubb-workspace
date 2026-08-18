import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminEmailTemplatesController } from './admin-email-templates.controller';

// Exercises the REAL RolesGuard against the REAL @Roles metadata attached to
// AdminEmailTemplatesController — not a mock of the guard mechanism. Proves
// the class-level @Roles(Role.SUPER_ADMIN) override actually blocks ADMIN,
// the exact regression this controller had (any shop-owner ADMIN could
// previously read/write platform-wide email templates).
function contextFor(handlerName: keyof AdminEmailTemplatesController, role: string | undefined): ExecutionContext {
  return {
    getHandler: () => AdminEmailTemplatesController.prototype[handlerName],
    getClass:   () => AdminEmailTemplatesController,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminEmailTemplatesController — @Roles(Role.SUPER_ADMIN) enforcement', () => {
  const guard = new RolesGuard(new Reflector());

  it.each(['list', 'get', 'update'] as const)('blocks ADMIN on %s', (handler) => {
    expect(guard.canActivate(contextFor(handler, 'ADMIN'))).toBe(false);
  });

  it.each(['list', 'get', 'update'] as const)('allows SUPER_ADMIN on %s', (handler) => {
    expect(guard.canActivate(contextFor(handler, 'SUPER_ADMIN'))).toBe(true);
  });

  it('blocks an unauthenticated request (no user) on update', () => {
    expect(guard.canActivate(contextFor('update', undefined))).toBe(false);
  });
});
