import { applyDecorators, Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { Role } from '@mlh/constants';
import { capitalize } from '@mlh/utils';

/**
 * Shorthand decorator for all admin controllers.
 *
 * Automatically:
 *   - Prefixes route with /admin/{path}
 *   - Requires JWT auth + role guard
 *   - Restricts to ADMIN and SUPER_ADMIN
 *   - Adds Swagger tags and bearer auth
 *
 * Usage:
 *   @AdminController('products')
 *   export class AdminProductsController {}
 */
export const AdminController = (path: string) => {
  const tag = path
    ? `Admin — ${capitalize(path)}`
    : 'Admin — Dashboard';

  return applyDecorators(
    Controller(`admin${path ? `/${path}` : ''}`),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(Role.ADMIN, Role.SUPER_ADMIN),
    ApiBearerAuth(),
    ApiTags(tag),
  );
};
