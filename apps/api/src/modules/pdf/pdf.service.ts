import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { InvoiceDocument } from './templates/invoice.template';
import { PackingSlipDocument } from './templates/packing-slip.template';

// Normalized, number-typed order shape consumed by PDF templates
export interface OrderForPdf {
  id: string;
  orderNumber: string;
  guestEmail: string | null;
  createdAt: Date;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string | null;
  shippingZip: string;
  shippingCountry: string;
  subtotal: number;
  discountAmount: number;
  affiliateDiscountAmount: number;
  shippingCost: number;
  taxAmount: number;
  taxJurisdiction: string | null;
  total: number;
  couponCode: string | null;
  isGift: boolean;
  giftMessage: string | null;
  giftFrom: string | null;
  giftReceipt: boolean;
  giftWrapping: boolean;
  userEmail: string | null;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    customizationData: Record<string, unknown> | null;
  }[];
}

const GIFT_WRAPPING_PRICE = 4.99;

@Injectable()
export class PdfService {
  private readonly logger  = new Logger(PdfService.name);
  private readonly shopUrl: string;

  constructor(
    private readonly prisma:   PrismaService,
    private readonly storage:  StorageService,
    private readonly config:   ConfigService,
  ) {
    this.shopUrl = this.config.get<string>('FRONTEND_URL', 'https://ezihubb.com');
  }

  // ── Public generators ───────────────────────────────────────────────────────

  /**
   * Generate (or return cached) invoice PDF.
   * - `isGiftReceipt`: `undefined` = auto-detect from order.giftReceipt; `false` = always full invoice
   * - `userId`: if provided, enforces ownership (customer callers); admin callers omit it
   */
  async generateInvoice(
    orderId:       string,
    isGiftReceipt: boolean | undefined,
    userId?:       string,
  ): Promise<string> {
    // Always fetch order first so ownership is checked before we hit the cache
    const order          = await this.fetchOrder(orderId, userId);
    const useGiftReceipt = isGiftReceipt ?? order.giftReceipt;
    const label          = useGiftReceipt ? 'gift-receipt' : 'invoice';
    const cacheKey       = `pdfs/${orderId}/${label}.pdf`;

    const exists = await this.storage.existsFile(cacheKey);
    if (exists) return this.storage.getPublicUrl(cacheKey);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      createElement(InvoiceDocument, { order, shopUrl: this.shopUrl, isGiftReceipt: useGiftReceipt }) as ReactElement<any>,
    );

    const url = await this.storage.uploadFile(buffer, cacheKey, 'application/pdf');
    this.logger.log(`Invoice PDF generated: order=${order.orderNumber} gift=${useGiftReceipt}`);
    return url;
  }

  async generatePackingSlip(orderId: string): Promise<string> {
    const cacheKey = `pdfs/${orderId}/packing-slip.pdf`;

    const exists = await this.storage.existsFile(cacheKey);
    if (exists) return this.storage.getPublicUrl(cacheKey);

    const order  = await this.fetchOrder(orderId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      createElement(PackingSlipDocument, { order }) as ReactElement<any>,
    );

    const url = await this.storage.uploadFile(buffer, cacheKey, 'application/pdf');
    this.logger.log(`Packing slip generated: order=${order.orderNumber}`);
    return url;
  }

  /** Bust cached PDFs when order address is corrected by admin */
  async invalidatePdfs(orderId: string): Promise<void> {
    await Promise.allSettled([
      this.storage.deleteFile(`pdfs/${orderId}/invoice.pdf`),
      this.storage.deleteFile(`pdfs/${orderId}/gift-receipt.pdf`),
      this.storage.deleteFile(`pdfs/${orderId}/packing-slip.pdf`),
    ]);
    this.logger.log(`PDF cache invalidated: order=${orderId}`);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async fetchOrder(orderId: string, userId?: string): Promise<OrderForPdf> {
    let raw: Awaited<ReturnType<typeof this.queryOrder>> | null = null;

    try {
      raw = await this.queryOrder(orderId, userId);
    } catch {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });
    }

    return {
      id:                     raw.id,
      orderNumber:            raw.orderNumber,
      guestEmail:             raw.guestEmail,
      createdAt:              raw.createdAt,
      shippingName:           raw.shippingName,
      shippingAddress:        raw.shippingAddress,
      shippingCity:           raw.shippingCity,
      shippingState:          raw.shippingState,
      shippingZip:            raw.shippingZip,
      shippingCountry:        raw.shippingCountry,
      subtotal:               Number(raw.subtotal),
      discountAmount:         Number(raw.discountAmount),
      affiliateDiscountAmount: Number(raw.affiliateDiscountAmount ?? 0),
      shippingCost:           Number(raw.shippingCost),
      taxAmount:              Number(raw.taxAmount ?? 0),
      taxJurisdiction:        raw.taxJurisdiction,
      total:                  Number(raw.total),
      couponCode:             raw.couponCode,
      isGift:                 raw.isGift,
      giftMessage:            raw.giftMessage,
      giftFrom:               raw.giftFrom,
      giftReceipt:            raw.giftReceipt,
      giftWrapping:           raw.giftWrapping,
      userEmail:              raw.user?.email ?? raw.guestEmail ?? null,
      items: raw.items.map((item) => ({
        id:                item.id,
        productName:       item.productName,
        variantName:       item.variantName,
        quantity:          item.quantity,
        unitPrice:         Number(item.unitPrice),
        customizationData: item.customizationData as Record<string, unknown> | null,
      })),
    };
  }

  private async queryOrder(orderId: string, userId?: string) {
    return this.prisma.order.findFirstOrThrow({
      where: {
        id: orderId,
        ...(userId !== undefined ? { userId } : {}),
      },
      select: {
        id:                      true,
        orderNumber:             true,
        guestEmail:              true,
        createdAt:               true,
        shippingName:            true,
        shippingAddress:         true,
        shippingCity:            true,
        shippingState:           true,
        shippingZip:             true,
        shippingCountry:         true,
        subtotal:                true,
        discountAmount:          true,
        affiliateDiscountAmount: true,
        shippingCost:            true,
        taxAmount:               true,
        taxJurisdiction:         true,
        total:                   true,
        couponCode:              true,
        isGift:                  true,
        giftMessage:             true,
        giftFrom:                true,
        giftReceipt:             true,
        giftWrapping:            true,
        items: {
          select: {
            id:                true,
            productName:       true,
            variantName:       true,
            quantity:          true,
            unitPrice:         true,
            customizationData: true,
          },
        },
        user: { select: { email: true, firstName: true } },
      },
    });
  }
}

export { GIFT_WRAPPING_PRICE };
