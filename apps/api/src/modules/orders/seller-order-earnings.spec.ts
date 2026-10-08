import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { ShippingService } from '../shipping/shipping.service';
import { MessagesService } from '../messages/messages.service';
import { SellerOrderDetailService } from './seller-order-detail.service';
import { readEconomicShopEarnings } from '../finances/economic-shop-earnings';
import { LEGACY_FINANCE_REPORT, legacyLedgerWhere } from '../finances/finance-reporting-scope';

jest.mock('../finances/economic-shop-earnings', () => ({ readEconomicShopEarnings: jest.fn() }));
const read = jest.mocked(readEconomicShopEarnings);
function fixture() {
  const prisma = { storeOrder: { findFirst: jest.fn(async () => ({ id: 'shop', orderId: 'order', subtotal: 2,
    discountAmount: 0, shippingCost: 0, shippingSubsidy: 0 })) },
    sellerLedgerEntry: { findMany: jest.fn(async () => [{ type: 'SALE', amount: 2, description: 'Original sale' },
      { type: 'TRANSACTION_FEE', amount: -0.2, description: 'Original fee' }]) },
    order: { findUnique: jest.fn(async () => ({ couponCode: null })) } };
  const service = new SellerOrderDetailService(prisma as unknown as PrismaService, {} as StorageService,
    {} as ShippingService, {} as MessagesService);
  return { service, prisma };
}
describe('order earnings routing never substitutes legacy values for versioned evidence', () => {
  beforeEach(() => read.mockReset());
  it('returns the versioned result without reading any legacy receipt or ledger', async () => {
    const h = fixture(), response = { version: 'economic-v1', state: 'AWAITING_CAPTURE', amounts: null };
    read.mockResolvedValue(response as never);
    expect(await h.service.getEarnings('store', 'shop')).toEqual(response);
    expect(read).toHaveBeenCalledWith(h.prisma, 'store', 'shop');
    expect(h.prisma.storeOrder.findFirst).not.toHaveBeenCalled();
    expect(h.prisma.sellerLedgerEntry.findMany).not.toHaveBeenCalled();
  });
  it('does not fall back to ledger or zeroes when versioned evidence is missing/corrupt/offline', async () => {
    const h = fixture(); read.mockRejectedValue(new Error('Original evidence requires reconciliation'));
    await expect(h.service.getEarnings('store', 'shop')).rejects.toThrow('requires reconciliation');
    expect(h.prisma.sellerLedgerEntry.findMany).not.toHaveBeenCalled();
  });
  it('keeps scoped historical ledger numbers with explicit unknown provenance', async () => {
    const h = fixture(); read.mockResolvedValue(null);
    expect(await h.service.getEarnings('store', 'shop')).toMatchObject({ version: 'legacy-ledger',
      financeReporting: LEGACY_FINANCE_REPORT, includedInAvailable: false, pending: false, youEarned: 1.8 });
    expect(h.prisma.storeOrder.findFirst).toHaveBeenCalledWith({ where: { id: 'shop', storeId: 'store' } });
    expect(h.prisma.sellerLedgerEntry.findMany).toHaveBeenCalledWith({ where: legacyLedgerWhere({ storeOrderId: 'shop', storeId: 'store' }),
      orderBy: { createdAt: 'asc' } });
  });
  it('does not infer capture from a legacy row with no ledger entries', async () => {
    const h = fixture(); read.mockResolvedValue(null); h.prisma.sellerLedgerEntry.findMany.mockResolvedValueOnce([]);
    expect(await h.service.getEarnings('store', 'shop')).toMatchObject({ pending: true, financeReporting: LEGACY_FINANCE_REPORT });
  });
});
