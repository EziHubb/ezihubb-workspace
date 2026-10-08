import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CheckoutRequest, Prisma } from '@prisma/client';
import { canonicalEconomicJson } from '../finances/economic-quote';
import { CheckoutDto, CheckoutResponseDto } from './dto/checkout.dto';

const digest = (value: unknown) => createHash('sha256').update(canonicalEconomicJson(value)).digest('hex');
export function checkoutIdentity(key: string, userId?: string, sessionId?: string) {
  if (!/^[A-Za-z0-9_-]{12,80}$/.test(key)) throw new BadRequestException('Invalid checkout request identity');
  if (!userId && !sessionId) throw new BadRequestException('Checkout requires an account or cart session');
  const scopeHash = digest(userId ? { account: userId } : { cartSession: sessionId });
  return { scopeHash, identityHash: digest({ scopeHash, key }) };
}
export function checkoutPayloadHash(dto: CheckoutDto) {
  // DTO was validated/whitelisted by HTTP. Omit identity and undefined fields;
  // hashes are persisted, never raw personal information or arbitrary cookies.
  return digest(JSON.parse(JSON.stringify({ ...dto, idempotencyKey: undefined })));
}
export function checkoutCartFingerprint(items: { id: string; productId: string; variantId: string | null; quantity: number;
  unitPrice?: { toString(): string }; customizationData?: unknown; previewUrl?: string | null; searchTerm?: string | null; storeId?: string | null }[]) {
  return digest(items.map(({ id, productId, variantId, quantity, unitPrice, customizationData, previewUrl, searchTerm, storeId }) =>
    ({ id, productId, variantId, quantity, unitPrice: unitPrice?.toString() ?? null,
      customization: JSON.stringify(customizationData ?? null), previewUrl: previewUrl ?? null,
      searchTerm: searchTerm ?? null, storeId: storeId ?? null }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export async function recoverCheckoutRequest(tx: Pick<Prisma.TransactionClient, 'checkoutRequest' | 'order'>,
  identity: { identityHash: string; scopeHash: string }, payloadHash?: string): Promise<CheckoutResponseDto | null> {
  const record = await tx.checkoutRequest.findUnique({ where: { identityHash: identity.identityHash } });
  if (!record) return null;
  if (record.scopeHash !== identity.scopeHash) throw new NotFoundException('Checkout request not found');
  if (payloadHash && record.payloadHash !== payloadHash) throw new ConflictException('Checkout request details changed. Recover the original request; do not submit another order.');
  const order = await tx.order.findUnique({ where: { id: record.orderId }, select: { status: true, adminArchivedAt: true } });
  if (!order || order.adminArchivedAt || ['CANCELLED', 'REFUND_REQUESTED', 'REFUNDED', 'DISPUTED'].includes(order.status)) {
    throw new ConflictException('The original checkout order is closed or deleted. Contact support; this request cannot create another order.');
  }
  return checkoutResponse(record);
}
export function checkoutResponse(record: Pick<CheckoutRequest, 'orderId' | 'orderNumber' | 'paymentRequired' | 'initialStatus' | 'totalMinor'>): CheckoutResponseDto {
  if (record.totalMinor < 0n || record.totalMinor > 9_999_999_999n) throw new Error('Invalid original checkout total');
  return { orderId: record.orderId, orderNumber: record.orderNumber, paymentRequired: record.paymentRequired,
    clientSecret: null, status: record.initialStatus, total: Number(record.totalMinor) / 100 };
}
