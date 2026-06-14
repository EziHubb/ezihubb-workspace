# Module 25 — Multi-Currency Display (P3-05)

## 1. Tổng quan

Hiển thị giá theo nhiều đơn vị tiền tệ. Giá lưu trữ và thanh toán bằng USD. Multi-currency chỉ là display layer — **không ảnh hưởng checkout amount**.

## 2. Supported Currencies

Codebase hiện chỉ định nghĩa 2 currencies trong `currency-context.tsx`:

| Code | Symbol | Name |
|---|---|---|
| USD | $ | US Dollar (base) |
| VND | ₫ | Vietnamese Dong |

> Backend API (`/currencies`) có thể trả về thêm currencies (EUR, GBP, JPY, CAD, AUD), nhưng client chỉ render những gì `SUPPORTED_CURRENCIES` export từ `currency-context.tsx`.

## 3. Exchange Rate Service (Backend)

### Source
- External API: exchangerate-api.com hoặc Frankfurter
- Env: `EXCHANGE_RATE_API_KEY`
- Cache: Redis key `exchange-rates:USD` (TTL: 1 hour)
- Fallback: last cached rates nếu API unavailable

### Endpoint
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
    "updatedAt": "2026-06-14T10:00:00Z",
    "rates": {
      "VND": 25400
    }
  }
}
```

## 4. Client: CurrencyProvider & currency-context

File: `apps/client/src/lib/currency/currency-context.tsx`

```typescript
const CURRENCIES = {
  USD: { symbol: '$', decimals: 2, flag: '🇺🇸', name: 'US Dollar'       },
  VND: { symbol: '₫', decimals: 0, flag: '🇻🇳', name: 'Vietnamese Dong' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;  // 'USD' | 'VND'

interface CurrencyContextType {
  currency:    CurrencyCode;
  symbol:      string;
  rates:       Record<string, number>;
  setCurrency: (code: CurrencyCode) => void;
  format:      (usdAmount: number) => string;
  isLoading:   boolean;
}
```

**Persistence:** Selected currency stored in localStorage (key: `mlh_currency`) VÀ cookie `mlh_currency` (max-age: 1 year)
**Initial currency:** Restore từ localStorage, fallback USD

`CurrencyProvider` wrap toàn app trong `apps/client/src/app/[locale]/layout.tsx`.

### format() logic
```typescript
function format(usdAmount: number): string {
  const cfg      = CURRENCIES[currency] ?? CURRENCIES.USD;
  const rate     = rates[currency] ?? 1;
  const converted = usdAmount * rate;
  const tilde    = currency !== 'USD' ? '~' : '';

  if (currency === 'VND') {
    return `${tilde}${cfg.symbol}${Math.round(converted).toLocaleString('vi-VN')}`;
  }
  return `${tilde}${cfg.symbol}${converted.toFixed(cfg.decimals)}`;
}
```

## 5. useCurrency Hook

File: `apps/client/src/lib/currency/currency-context.tsx` (exported hook)

```typescript
export const useCurrency = () => useContext(CurrencyContext);

// Usage
const { format, currency, setCurrency, isLoading } = useCurrency();
// format(29.99) → "$29.99" (USD) hoặc "~₫761,775" (VND)
```

## 6. CurrencyPicker Component

File: `apps/client/src/components/layout/CurrencyPicker.tsx`

- Dropdown component (flag + code + chevron)
- Import: `useCurrency, SUPPORTED_CURRENCIES` từ `currency-context`
- **Hiện KHÔNG được mount trong Navbar hoặc MobileNavDrawer**
- Component tồn tại nhưng ít hiển thị; có thể dùng trong các page khác

## 7. Integration Points

### ProductCard
```tsx
const { format } = useCurrency();
<span>{format(product.basePrice)}</span>
```

### ProductPurchasePanel (Product Detail)
- Hiển thị giá theo selected currency
- "Prices shown in {currency}. Checkout processed in USD." disclaimer

### Checkout
- Cart subtotal hiển thị trong selected currency
- Checkout form hiển thị USD equivalent + disclaimer
- Payment processed in USD (Stripe/PayPal)

### CartDrawer
- Item prices và totals trong selected currency

## 8. Business Rules

- Giá lưu trong DB bằng USD (Decimal)
- Chuyển đổi chỉ xảy ra ở client (presentation layer)
- Checkout luôn charge bằng USD
- Rates cache 1h trong Redis; stale rates acceptable
- VND hiển thị không có decimal, prefix `~` cho non-USD
- Admin app luôn hiển thị USD (không dùng multi-currency)
- **CurrencyPicker không còn trong Navbar** — LocaleSwitcher là selector duy nhất trên Navbar
