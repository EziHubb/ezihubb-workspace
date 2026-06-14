import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

/**
 * Gates an endpoint behind a specific permission.
 * Use "resource:action" format, e.g. @RequirePermission('products:delete')
 * Works with PermissionsGuard — must be applied alongside @UseGuards(PermissionsGuard).
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
