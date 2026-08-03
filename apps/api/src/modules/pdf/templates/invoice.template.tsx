import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { OrderForPdf } from '../pdf.service';
import { fmtDate } from '@ezihubb/utils';

const GIFT_WRAPPING_PRICE = 4.99;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  brandName: { fontSize: 18, fontWeight: 'bold', color: '#E85D3F' },
  brandSub:  { fontSize: 9, color: '#6B7280', marginTop: 3 },
  invoiceTitle:  { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  invoiceNumber: { fontSize: 10, color: '#6B7280', marginTop: 4 },
  sectionTitle: {
    fontSize: 9, fontWeight: 'bold', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  addressLine: { fontSize: 10, color: '#2D2D2D', lineHeight: 1.6 },
  tableHeader: {
    flexDirection: 'row', backgroundColor: '#F9FAFB',
    padding: '8 12', borderRadius: 4,
  },
  tableHeaderText: { fontSize: 9, fontWeight: 'bold', color: '#6B7280' },
  tableRow: {
    flexDirection: 'row', padding: '10 12',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  col_product: { flex: 3 },
  col_qty:     { flex: 1, textAlign: 'center' },
  col_price:   { flex: 1, textAlign: 'right' },
  col_total:   { flex: 1, textAlign: 'right' },
  productName: { fontSize: 10, color: '#1A1A1A', fontWeight: 'bold' },
  productMeta: { fontSize: 9, color: '#6B7280', marginTop: 2, lineHeight: 1.5 },
  totalsBox: {
    marginTop: 16, padding: '12 16',
    backgroundColor: '#F9FAFB', borderRadius: 6,
    alignSelf: 'flex-end', minWidth: 240,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3,
  },
  totalLabel: { fontSize: 10, color: '#6B7280' },
  totalValue: { fontSize: 10, color: '#2D2D2D' },
  grandTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, marginTop: 8,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  grandTotalLabel: { fontSize: 12, fontWeight: 'bold', color: '#1A1A1A' },
  grandTotalValue: { fontSize: 12, fontWeight: 'bold', color: '#E85D3F' },
  giftBox: {
    marginTop: 24, padding: '12 16',
    backgroundColor: '#FFF7ED', borderRadius: 8,
  },
  giftTitle: {
    fontSize: 9, fontWeight: 'bold', color: '#C2410C',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
  },
  footer: {
    position: 'absolute', bottom: 32, left: 40, right: 40,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 8, color: '#9CA3AF' },
});

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

interface Props {
  order:          OrderForPdf;
  shopUrl:        string;
  isGiftReceipt?: boolean;
}

export function InvoiceDocument({ order, shopUrl, isGiftReceipt = false }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>EziHubb</Text>
            <Text style={styles.brandSub}>{shopUrl.replace(/^https?:\/\//, '')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.invoiceTitle}>
              {isGiftReceipt ? 'GIFT RECEIPT' : 'INVOICE'}
            </Text>
            <Text style={styles.invoiceNumber}>#{order.orderNumber}</Text>
            <Text style={[styles.invoiceNumber, { marginTop: 2 }]}>{fmtDate(order.createdAt)}</Text>
          </View>
        </View>

        {/* ── Addresses ──────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', marginBottom: 28, gap: 32 }}>
          {/* Sold to */}
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Sold to</Text>
            <Text style={styles.addressLine}>{order.shippingName}</Text>
            <Text style={styles.addressLine}>{order.shippingAddress}</Text>
            <Text style={styles.addressLine}>
              {order.shippingCity}{order.shippingState ? `, ${order.shippingState}` : ''} {order.shippingZip}
            </Text>
            <Text style={styles.addressLine}>{order.shippingCountry}</Text>
            {order.userEmail && (
              <Text style={[styles.addressLine, { marginTop: 6 }]}>{order.userEmail}</Text>
            )}
          </View>
          {/* From */}
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>From</Text>
            <Text style={styles.addressLine}>EziHubb</Text>
            <Text style={styles.addressLine}>support@ezihubb.com</Text>
            <Text style={styles.addressLine}>{shopUrl}</Text>
          </View>
        </View>

        {/* ── Items table ────────────────────────────────────────── */}
        <View style={{ marginBottom: 16 }}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.col_product]}>Product</Text>
            <Text style={[styles.tableHeaderText, styles.col_qty]}>Qty</Text>
            {!isGiftReceipt && (
              <>
                <Text style={[styles.tableHeaderText, styles.col_price]}>Unit Price</Text>
                <Text style={[styles.tableHeaderText, styles.col_total]}>Total</Text>
              </>
            )}
          </View>

          {order.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <View style={styles.col_product}>
                <Text style={styles.productName}>{item.productName}</Text>
                {item.variantName && (
                  <Text style={styles.productMeta}>{item.variantName}</Text>
                )}
                {item.customizationData &&
                  Object.entries(item.customizationData).map(([k, v]) => (
                    <Text key={k} style={styles.productMeta}>
                      {k}: {String(v)}
                    </Text>
                  ))
                }
              </View>
              <Text style={[{ fontSize: 10, color: '#2D2D2D' }, styles.col_qty]}>
                {item.quantity}
              </Text>
              {!isGiftReceipt && (
                <>
                  <Text style={[{ fontSize: 10, color: '#2D2D2D' }, styles.col_price]}>
                    {fmt(item.unitPrice)}
                  </Text>
                  <Text style={[{ fontSize: 10, fontWeight: 'bold', color: '#1A1A1A' }, styles.col_total]}>
                    {fmt(item.unitPrice * item.quantity)}
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>

        {/* ── Totals (hidden for gift receipt) ───────────────────── */}
        {!isGiftReceipt && (
          <View style={{ alignItems: 'flex-end' }}>
            <View style={styles.totalsBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{fmt(order.subtotal)}</Text>
              </View>

              {order.discountAmount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    Discount{order.couponCode ? ` (${order.couponCode})` : ''}
                  </Text>
                  <Text style={[styles.totalValue, { color: '#16A34A' }]}>
                    -{fmt(order.discountAmount)}
                  </Text>
                </View>
              )}

              {order.affiliateDiscountAmount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Referral discount</Text>
                  <Text style={[styles.totalValue, { color: '#16A34A' }]}>
                    -{fmt(order.affiliateDiscountAmount)}
                  </Text>
                </View>
              )}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Shipping</Text>
                <Text style={styles.totalValue}>
                  {order.shippingCost === 0 ? 'FREE' : fmt(order.shippingCost)}
                </Text>
              </View>

              {order.taxAmount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    Tax{order.taxJurisdiction ? ` (${order.taxJurisdiction})` : ''}
                  </Text>
                  <Text style={styles.totalValue}>{fmt(order.taxAmount)}</Text>
                </View>
              )}

              {order.giftWrapping && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Gift wrapping</Text>
                  <Text style={styles.totalValue}>{fmt(GIFT_WRAPPING_PRICE)}</Text>
                </View>
              )}

              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>{fmt(order.total)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Gift message ────────────────────────────────────────── */}
        {order.isGift && order.giftMessage && (
          <View style={styles.giftBox}>
            <Text style={styles.giftTitle}>Gift message</Text>
            <Text style={{ fontSize: 11, color: '#2D2D2D', fontStyle: 'italic', lineHeight: 1.6 }}>
              "{order.giftMessage}"
            </Text>
            {order.giftFrom && (
              <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 6 }}>
                — {order.giftFrom}
              </Text>
            )}
          </View>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thank you for your order!  Questions? support@ezihubb.com
          </Text>
          <Text style={styles.footerText}>Page 1 of 1</Text>
        </View>

      </Page>
    </Document>
  );
}
