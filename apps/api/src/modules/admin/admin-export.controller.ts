import { Get, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { fmtDateTimeVN, fmtDateISOVN } from '../../common/utils/date';

@AdminController('export')
export class AdminExportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('data')
  @ApiOperation({ summary: 'Export all orders and customers as CSV' })
  async exportData(@Res() res: Response) {
    const [orders, customers] = await Promise.all([
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          orderNumber: true,
          status: true,
          total: true,
          subtotal: true,
          shippingCost: true,
          shippingName: true,
          shippingAddress: true,
          shippingCity: true,
          shippingState: true,
          shippingCountry: true,
          createdAt: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { role: 'CUSTOMER', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
    ]);

    const lines: string[] = [];

    // Orders section
    lines.push('=== ORDERS ===');
    lines.push('Order Number,Status,Total,Subtotal,Shipping,Customer Email,Customer Name,Ship To,City,State,Country,Created At');
    for (const o of orders) {
      const customerName = o.user ? `${o.user.firstName ?? ''} ${o.user.lastName ?? ''}`.trim() : '';
      lines.push([
        o.orderNumber,
        o.status,
        o.total.toString(),
        o.subtotal.toString(),
        o.shippingCost.toString(),
        o.user?.email ?? '',
        csvEscape(customerName),
        csvEscape(o.shippingName ?? ''),
        csvEscape(o.shippingAddress ?? ''),
        csvEscape(o.shippingCity ?? ''),
        csvEscape(o.shippingState ?? ''),
        csvEscape(o.shippingCountry ?? ''),
        fmtDateTimeVN(o.createdAt),
      ].join(','));
    }

    lines.push('');

    // Customers section
    lines.push('=== CUSTOMERS ===');
    lines.push('ID,Email,First Name,Last Name,Active,Total Orders,Joined');
    for (const c of customers) {
      lines.push([
        c.id,
        c.email,
        csvEscape(c.firstName ?? ''),
        csvEscape(c.lastName ?? ''),
        c.isActive ? 'yes' : 'no',
        c._count.orders.toString(),
        fmtDateTimeVN(c.createdAt),
      ].join(','));
    }

    const csv = lines.join('\n');
    const filename = `ezihubb-export-${fmtDateISOVN(new Date())}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}

function csvEscape(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
