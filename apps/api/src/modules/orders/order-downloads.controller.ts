import { Controller, Get, Param, Query, Req, Res, UseGuards, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

const sharp = require('sharp');

const RASTER_MIMETYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// Digital-download delivery is a server-side proxy, never a redirect/signed
// URL to the raw object (see StorageService.getFileBuffer) — access is
// re-checked on every request from live Order state (COMPLETED only, so a
// refund silently revokes access with zero extra bookkeeping) and the bytes
// are stamped with the buyer's own order number before they ever leave the
// server, so a leaked copy can be traced back to who downloaded it.
@ApiTags('Orders')
@Controller('orders')
export class OrderDownloadsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get(':orderNumber/downloads/:fileId')
  @UseGuards(OptionalAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Download a purchased digital file — authenticated users by userId, guests by email query param' })
  @ApiQuery({ name: 'email', required: false })
  async download(
    @Param('orderNumber') orderNumber: string,
    @Param('fileId') fileId: string,
    @Query('email') email: string | undefined,
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Guard against Prisma silently dropping an `undefined` filter — without
    // this, an unauthenticated request with no ?email= would resolve to
    // `where: { orderNumber }` alone and return ANY order with that number,
    // including other users' orders. Ownership must always be proven.
    if (!user && !email) {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'email is required for guest downloads' });
    }

    const order = await this.prisma.order.findFirst({
      where: user
        ? { orderNumber, userId: user.sub }
        : { orderNumber, guestEmail: email!.toLowerCase() },
      select: {
        id: true,
        status: true,
        items: { select: { id: true, productId: true, variantId: true } },
      },
    });
    if (!order) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });

    // Access is derived live from order status, never a separate grant —
    // this is also how a refund revokes access with no extra bookkeeping.
    if (order.status !== OrderStatus.COMPLETED) {
      throw new ForbiddenException({ code: 'ERR_NOT_AVAILABLE', message: 'This order\'s files are not available for download' });
    }

    const file = await this.prisma.digitalFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'File not found' });

    // A file scoped to one variant (file.variantId set) requires an order item
    // for that exact variant; a product-wide file (variantId null) matches any
    // item for that product.
    const orderItem = order.items.find(
      (i) => i.productId === file.productId && (!file.variantId || i.variantId === file.variantId),
    );
    if (!orderItem) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'File not found' });

    const original = await this.storage.getFileBuffer(file.storageKey);
    const stampLabel = `Order #${orderNumber}`;
    const buffer = await this.stampBuffer(original, file.mimeType, stampLabel);

    await this.prisma.digitalDownloadLog.create({
      data: {
        orderItemId: orderItem.id,
        fileId: file.id,
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/"/g, '')}"`);
    res.send(buffer);
  }

  /**
   * Per-buyer traceability stamp. Raster images get real EXIF metadata; SVG
   * gets an inline XML comment. Everything else (PDF/ZIP/fonts/etc) isn't
   * stamped in v1 — the DigitalDownloadLog audit row is the fallback trace.
   */
  private async stampBuffer(buffer: Buffer, mimeType: string, label: string): Promise<Buffer> {
    if (RASTER_MIMETYPES.has(mimeType)) {
      try {
        return await sharp(buffer)
          .withMetadata({
            exif: {
              IFD0: {
                Copyright: `Licensed to ${label} — do not redistribute`,
                ImageDescription: `Licensed to ${label}`,
              },
            },
          })
          .toBuffer();
      } catch {
        return buffer; // stamping is best-effort; never block a legitimate download
      }
    }

    if (mimeType === 'image/svg+xml') {
      const text = buffer.toString('utf8');
      const comment = `<!-- Licensed to ${label} — do not redistribute -->\n`;
      const stamped = text.includes('<svg')
        ? text.replace('<svg', `${comment}<svg`)
        : comment + text;
      return Buffer.from(stamped, 'utf8');
    }

    return buffer;
  }
}
