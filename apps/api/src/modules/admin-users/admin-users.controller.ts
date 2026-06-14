import {
  Controller, Get, Put, Param, Body,
  UseGuards, NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { Role }         from '@mlh/constants';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PermissionDocument,
  DEFAULT_PERMISSION_DOCUMENT,
  PERMISSION_RESOURCES,
  RESOURCE_ACTIONS,
  BUILTIN_ROLE_NAMES,
  resolveEffectivePermissions,
} from '@mlh/constants';

@ApiTags('Admin — User Permissions')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  // ── List all shop-owner admin accounts ────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all shop-owner admin accounts' })
  async listAdmins() {
    const users = await this.prisma.user.findMany({
      where:   { role: 'ADMIN', isSeller: true },
      select:  {
        id:          true,
        email:       true,
        firstName:   true,
        lastName:    true,
        avatarUrl:   true,
        createdAt:   true,
        permissions: true,
        storeId:     true,
        ownedStore:  { select: { id: true, name: true, slug: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      ...u,
      effectivePermissions: resolveEffectivePermissions(
        'ADMIN',
        u.permissions as PermissionDocument | null,
      ),
    }));
  }

  // ── Get one admin's permissions ───────────────────────────────────────────

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Get permissions for a shop-owner admin' })
  async getPermissions(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where:  { id, role: 'ADMIN' },
      select: { id: true, email: true, firstName: true, lastName: true, permissions: true },
    });
    if (!user) throw new NotFoundException('Admin user not found');

    const permDoc = (user.permissions ?? DEFAULT_PERMISSION_DOCUMENT) as PermissionDocument;

    return {
      userId:               user.id,
      email:                user.email,
      name:                 `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      document:             permDoc,
      effectivePermissions: resolveEffectivePermissions('ADMIN', permDoc),
      availableRoles:       BUILTIN_ROLE_NAMES,
    };
  }

  // ── Update permissions ────────────────────────────────────────────────────
  // Body shape: { document: PermissionDocument }

  @Put(':id/permissions')
  @ApiOperation({ summary: 'Update permissions for a shop-owner admin' })
  async updatePermissions(
    @Param('id') id: string,
    @Body() body: { document: PermissionDocument },
  ) {
    const user = await this.prisma.user.findUnique({
      where:  { id, role: 'ADMIN' },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Admin user not found');

    const incoming = body.document;

    // Sanitize — only allow known role names and resource:action strings
    const allKnownPerms = PERMISSION_RESOURCES.flatMap((r) =>
      RESOURCE_ACTIONS[r].map((a) => `${r}:${a}`),
    );

    const sanitized: PermissionDocument = {
      roles: (incoming.roles ?? []).filter((r) =>
        BUILTIN_ROLE_NAMES.includes(r as typeof BUILTIN_ROLE_NAMES[number]),
      ),
      overrides: {
        allow: (incoming.overrides?.allow ?? []).filter((p) => allKnownPerms.includes(p)),
        deny:  (incoming.overrides?.deny  ?? []).filter((p) => allKnownPerms.includes(p)),
      },
      conditions: incoming.conditions ?? {},
    };

    await this.prisma.user.update({
      where: { id },
      data:  { permissions: JSON.parse(JSON.stringify(sanitized)) },
    });

    return {
      success:              true,
      document:             sanitized,
      effectivePermissions: resolveEffectivePermissions('ADMIN', sanitized),
    };
  }

  // ── Reset to defaults ─────────────────────────────────────────────────────

  @Put(':id/permissions/reset')
  @ApiOperation({ summary: 'Reset a shop-owner admin to default shop_owner role' })
  async resetPermissions(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where:  { id, role: 'ADMIN' },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Admin user not found');

    await this.prisma.user.update({
      where: { id },
      data:  { permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSION_DOCUMENT)) },
    });

    return { success: true, document: DEFAULT_PERMISSION_DOCUMENT };
  }
}
