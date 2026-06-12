# Module 25 — Multi-Currency Display (P3-05)

## 1. Tổng quan

Hiển thị giá theo nhiều đơn vị tiền tệ. Giá lưu trữ và thanh toán bằng USD. Multi-currency chỉ là display layer — không ảnh hưởng checkout amount.

## 2. Supported Currencies (ban đầu)

| Code | Symbol | Name |
|---|---|---|
| USD | $ | US Dollar (base) |
| EUR | € | Euro |
| GBP | £ | British Pound |
| VND | ₫ | Vietnamese Dong |
| JPY | ¥ | Japanese Yen |
| CAD | C$ | Canadian Dollar |
| AUD | A$ | Australian Dollar |

## 3. Exchange Rate Service

### Source
- External API: [exchangerate-api.com](https://exchangerate-api.com) hoặc Frankfurter
- Env: `EXCHANGE_RATE_API_KEY`
- Cache: Redis key `exchange-rates:USD` (TTL: 1 hour)
- Fallback: last cached rates nếu API unavailable

### Endpoint (Internal / Admin)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/currencies` | List supported currencies + current rates | No |
| POST | `/api/v1/admin/currencies/refresh` | Force refresh rates from API | ADMIN |

### Rate Response
```json
{
  "success": true,
  "data": {
    "base": "USD",
    "updatedAt": "2026-06-12T10:00:00Z",
    "rates": {
      "EUR": 0.92,
      "GBP": 0.79,
      "VND": 25400,
      "JPY": 154.5
    }
  }
}
```

## 4. Client: CurrencyProvider

File: `apps/client/src/components/providers/CurrencyProvider.tsx`

```typescript
interface CurrencyContext {
  currency: string;        // e.g. "USD"
  symbol: string;          // e.g. "$"
  rates: Record<string, number>;
  setCurrency: (code: string) => void;
  format: (amountUsd: number) => string;  // convert + format
}
```

**Persistence:** Selected currency stored in localStorage (key: `mlh-currency`)
**Initial currency:** Browser locale detection → fallback USD

### format() logic
```typescript
function format(amountUsd: number): string {
  const converted = amountUsd * rates[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' || currency === 'VND' ? 0 : 2,
  }).format(converted);
}
```

## 5. useCurrency Hook

File: `apps/client/src/hooks/useCurrency.ts`

```typescript
const { format, currency, setCurrency } = useCurrency();
// Usage: format(29.99) → "€27.59" (when EUR selected)
```

## 6. CurrencyPicker Component

File: `apps/client/src/components/layout/CurrencyPicker.tsx`

- Dropdown in Navbar (desktop) and MobileNavDrawer (mobile)
- Shows currency code + symbol
- On change: update context + localStorage

## 7. Integration Points

### ProductCard
```tsx
<span>{format(product.basePrice)}</span>
```

### PurchasePanel (Product Detail)
- Display price in selected currency
- "Prices shown in {currency}. Checkout processed in USD." disclaimer

### Checkout
- Cart subtotal displayed in selected currency
- Checkout form shows USD equivalent + disclaimer
- Payment processed in USD (Stripe/PayPal)

### CartDrawer
- Item prices and totals in selected currency

## 8. Business Rules

- Giá lưu trong DB bằng USD (Decimal)
- Chuyển đổi chỉ xảy ra ở client (presentation layer)
- Checkout luôn charge bằng USD
- Rates cache 1h trong Redis; stale rates acceptable (không cần real-time)
- VND và JPY hiển thị không có decimal
- Admin app luôn hiển thị USD (không cần multi-currency)
