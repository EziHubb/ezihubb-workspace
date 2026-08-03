import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { can, getConditions, PermissionDocument } from '@ezihubb/constants';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma:    PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequirePermission annotation → pass through (rely on RolesGuard)
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user    = request.user;
    const role    = user?.role as string | undefined;

    if (!role) throw new ForbiddenException('Authentication required');

    // SUPER_ADMIN bypasses all permission checks
    if (role === 'SUPER_ADMIN') return true;

    // Non-admin roles never pass permission-gated endpoints
    if (role !== 'ADMIN') {
      throw new ForbiddenException({
        code:    'ERR_FORBIDDEN',
        message: `Role ${role} cannot perform ${required}`,
      });
    }

    // Fetch the user's PermissionDocument from DB
    const userId = user?.sub ?? user?.id;
    const dbUser = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { permissions: true },
    });

    const permDoc = dbUser?.permissions as PermissionDocument | null;

    if (!can(role, permDoc, required)) {
      throw new ForbiddenException({
        code:    'ERR_PERMISSION_DENIED',
        message: `Permission denied: ${required}`,
      });
    }

    // Attach to request for downstream use (e.g. owner_only condition check)
    request.userPermissions = permDoc;
    request.permissionConditions = getConditions(permDoc, required);

    return true;
  }
}
