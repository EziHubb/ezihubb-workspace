import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { buildPagination } from '../../common/dto/paginated-response.dto';
import { fmtDateTimeVN } from '../../common/utils/date';

// Customers are platform-wide entities with no per-store scoping anywhere
// in this controller — browsing/searching/suspending/exporting the entire
// customer base is a platform-operator action, so this is SUPER_ADMIN-only
// (built manually rather than @AdminController + a class-level @Roles()
// override — see the comment in admin-team.controller.ts for why).
@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@ApiBearerAuth()
@ApiTags('Admin — Customers')
export class AdminCustomersController {
  constructor(
    private readonly prisma:    PrismaService,
    private readonly auditLog:  AuditLogService,
  ) {}

  // GET /admin/customers
  @Get()
  @ApiOperation({ summary: 'List customers (paginated, searchable)' })
  async list(@Query() query: AdminCustomerQueryDto) {
    const { page = 1, limit = 30, search, role, sort = 'createdAt', order = 'desc' } = query;

    const where: Prisma.UserWhereInput = {
      role: role ? { equals: role as any } : { in: ['CUSTOMER'] as any },
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          isEmailVerified: true,
          isActive: true,
          _count: { select: { orders: true } },
          orders: {
            select: { total: true },
            where: { status: { not: 'CANCELLED' as any } },
          },
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarUrl: u.avatarUrl,
      role: u.role,
      createdAt: u.createdAt,
      isEmailVerified: u.isEmailVerified,
      isActive: u.isActive,
      ordersCount: u._count.orders,
      totalSpent: u.orders.reduce((sum, o) => sum + Number(o.total), 0),
    }));

    return { data, pagination: buildPagination(page, limit, total) };
  }

  // GET /admin/customers/stats
  @Get('stats')
  @ApiOperation({ summary: 'Aggregate customer KPIs' })
  async stats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, newThisMonth, withOrders, topSpendersRaw] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
      this.prisma.user.count({
        where: { role: 'CUSTOMER', deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.user.count({
        where: { role: 'CUSTOMER', deletedAt: null, orders: { some: {} } },
      }),
      this.prisma.user.findMany({
        where: { role: 'CUSTOMER', deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          orders: {
            select: { total: true },
            where: { status: { not: 'CANCELLED' as any } },
          },
        },
        take: 50,
      }),
    ]);

    const topSpenders = topSpendersRaw
      .map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        totalSpent: u.orders.reduce((s, o) => s + Number(o.total), 0),
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    return { total, newThisMonth, withOrders, topSpenders };
  }

  // GET /admin/customers/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get full customer profile' })
  async detail(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        affiliateAccount: {
          select: { id: true, referralCode: true, status: true, balance: true },
        },
        _count: { select: { orders: true, reviews: true, wishlistItems: true } },
      },
    });
    if (!user) throw new NotFoundException('Customer not found');
    const { passwordHash, totpSecret, backupCodes, ...safe } = user as any;
    void passwordHash; void totpSecret; void backupCodes;
    return safe;
  }

  // GET /admin/customers/:id/orders
  @Get(':id/orders')
  @ApiOperation({ summary: "Get customer's order history" })
  async orders(@Param('id') id: string, @Query() query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId: id },
        include: {
          items: {
            include: { product: { select: { name: true } } },
            take: 3,
          },
          payment: { select: { status: true, method: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId: id } }),
    ]);

    return { data: orders, pagination: buildPagination(page, limit, total) };
  }

  // PATCH /admin/customers/:id/notes
  @Patch(':id/notes')
  @ApiOperation({ summary: 'Update admin notes on a customer' })
  async updateNotes(
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    await this.prisma.user.update({
      where: { id },
      data: { adminNotes: notes },
    });
    return { updated: true };
  }

  // PATCH /admin/customers/:id/status
  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or suspend a customer account' })
  async updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
    const userId = (req.user as { sub: string }).sub;
    this.auditLog.log({
      userId,
      action:     isActive ? 'ACTIVATE' : 'SUSPEND',
      entityType: 'User',
      entityId:   id,
      after:      { isActive },
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
    return { updated: true };
  }

  // PATCH /admin/customers/:id/tags
  @Patch(':id/tags')
  @ApiOperation({ summary: 'Update admin-managed tags on a customer' })
  async updateTags(@Param('id') id: string, @Body('tags') tags: string[]) {
    await this.prisma.user.update({ where: { id }, data: { adminTags: tags ?? [] } });
    return { updated: true };
  }

  // GET /admin/customers/export — CSV export
  @Get('export')
  @ApiOperation({ summary: 'Export customers to CSV' })
  async exportCsv(@Query() query: { search?: string; role?: string }, @Res() res: Response) {
    const where: Prisma.UserWhereInput = {
      role: query.role ? { equals: query.role as any } : { in: ['CUSTOMER'] as any },
      deletedAt: null,
      ...(query.search ? { OR: [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, createdAt: true, isEmailVerified: true, isActive: true,
        _count: { select: { orders: true } },
        orders: { select: { total: true }, where: { status: { not: 'CANCELLED' as any } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const header = 'id,email,firstName,lastName,role,ordersCount,totalSpent,isActive,isEmailVerified,createdAt';
    const rows = users.map((u) => {
      const totalSpent = u.orders.reduce((s, o) => s + Number(o.total), 0);
      return [u.id, u.email, u.firstName ?? '', u.lastName ?? '', u.role,
        u._count.orders, totalSpent.toFixed(2), u.isActive, u.isEmailVerified,
        fmtDateTimeVN(u.createdAt)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="customers-${Date.now()}.csv"`);
    res.send([header, ...rows].join('\n'));
  }

  // POST /admin/customers/:id/impersonate  (stub — returns token-less session info)
  @Post(':id/impersonate')
  @ApiOperation({ summary: 'Get customer session info for support impersonation' })
  async impersonate(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, firstName: true, lastName: true, role: true } });
    if (!user) throw new NotFoundException('Customer not found');
    return { user };
  }
}
