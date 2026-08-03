import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { OrderForPdf } from '../pdf.service';

export function PackingSlipDocument({ order }: { order: OrderForPdf }) {
  return (
    <Document>
      <Page size="A5" style={{ fontFamily: 'Helvetica', fontSize: 10, padding: 24, backgroundColor: '#FFFFFF' }}>

        {/* ── Top bar ───────────────────────────────────────────── */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between',
          marginBottom: 20, paddingBottom: 12,
          borderBottomWidth: 2, borderBottomColor: '#1A1A1A',
        }}>
          <View>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' }}>
              EziHubb
            </Text>
            <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>PACKING SLIP</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1A1A1A' }}>
              #{order.orderNumber}
            </Text>
            <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>
              {new Date(order.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* ── Ship to (no phone — couriers don't need it, privacy) ── */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#6B7280', letterSpacing: 1, marginBottom: 6 }}>
            SHIP TO
          </Text>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1A1A1A' }}>{order.shippingName}</Text>
          <Text style={{ fontSize: 10, lineHeight: 1.5, color: '#2D2D2D' }}>{order.shippingAddress}</Text>
          <Text style={{ fontSize: 10, color: '#2D2D2D' }}>
            {order.shippingCity}{order.shippingState ? `, ${order.shippingState}` : ''} {order.shippingZip}
          </Text>
          <Text style={{ fontSize: 10, color: '#2D2D2D' }}>{order.shippingCountry}</Text>
        </View>

        {/* ── Items ─────────────────────────────────────────────── */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#6B7280', letterSpacing: 1, marginBottom: 8 }}>
            ITEMS ({order.items.reduce((s, i) => s + i.quantity, 0)})
          </Text>

          {order.items.map((item, i) => (
            <View key={item.id} style={{
              padding: '8 0',
              borderBottomWidth: i < order.items.length - 1 ? 1 : 0,
              borderBottomColor: '#E5E7EB',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1A1A1A', flex: 1 }}>
                  {item.productName}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1A1A1A', marginLeft: 12 }}>
                  ×{item.quantity}
                </Text>
              </View>

              {item.variantName && (
                <Text style={{ fontSize: 9, color: '#4B5563', marginTop: 2 }}>
                  {item.variantName}
                </Text>
              )}

              {/* Custom options highlighted in red — picker must not miss them */}
              {item.customizationData &&
                Object.entries(item.customizationData).map(([k, v]) => (
                  <Text key={k} style={{ fontSize: 9, color: '#E85D3F', fontWeight: 'bold', marginTop: 3 }}>
                    ★ {k}: {String(v)}
                  </Text>
                ))
              }
            </View>
          ))}
        </View>

        {/* ── Gift message ────────────────────────────────────────── */}
        {order.isGift && order.giftMessage && (
          <View style={{
            marginTop: 8, padding: '10 12',
            backgroundColor: '#FFF7ED', borderRadius: 6,
          }}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#C2410C', marginBottom: 4 }}>
              GIFT MESSAGE — INCLUDE CARD
            </Text>
            <Text style={{ fontSize: 10, fontStyle: 'italic', color: '#2D2D2D', lineHeight: 1.5 }}>
              "{order.giftMessage}"
            </Text>
            {order.giftFrom && (
              <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 4 }}>
                — {order.giftFrom}
              </Text>
            )}
          </View>
        )}

        {/* ── Gift receipt note ───────────────────────────────────── */}
        {order.giftReceipt && (
          <View style={{ marginTop: 8, padding: '6 12', backgroundColor: '#F0FDF4', borderRadius: 4 }}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#15803D' }}>
              ✓ GIFT RECEIPT — DO NOT INCLUDE INVOICE
            </Text>
          </View>
        )}

      </Page>
    </Document>
  );
}
