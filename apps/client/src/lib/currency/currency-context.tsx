'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const CURRENCY_COOKIE = 'mlh_currency';
const CURRENCY_LS_KEY = 'mlh_currency';
const API_URL         = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';

const CURRENCIES = {
  USD: { symbol: '$',   decimals: 2, flag: '🇺🇸', name: 'US Dollar'       },
  EUR: { symbol: '€',   decimals: 2, flag: '🇪🇺', name: 'Euro'            },
  GBP: { symbol: '£',   decimals: 2, flag: '🇬🇧', name: 'British Pound'   },
  CAD: { symbol: 'CA$', decimals: 2, flag: '🇨🇦', name: 'Canadian Dollar' },
  VND: { symbol: '₫',   decimals: 0, flag: '🇻🇳', name: 'Vietnamese Dong' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const SUPPORTED_CURRENCIES = Object.entries(CURRENCIES).map(([code, cfg]) => ({
  code:   code as CurrencyCode,
  symbol: cfg.symbol,
  flag:   cfg.flag,
  name:   cfg.name,
}));

interface CurrencyContextType {
  currency:    CurrencyCode;
  symbol:      string;
  rates:       Record<string, number>;
  setCurrency: (code: CurrencyCode) => void;
  format:      (usdAmount: number) => string;
  isLoading:   boolean;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency:    'USD',
  symbol:      '$',
  rates:       { USD: 1 },
  setCurrency: () => undefined,
  format:      (n) => `$${n.toFixed(2)}`,
  isLoading:   false,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency,  setCurrencyState] = useState<CurrencyCode>('USD');
  const [rates,     setRates]         = useState<Record<string, number>>({ USD: 1 });
  const [isLoading, setIsLoading]     = useState(true);

  useEffect(() => {
    // Restore preference from localStorage (cookie is server-side read-only here)
    const stored = (localStorage.getItem(CURRENCY_LS_KEY) as CurrencyCode | null) ?? 'USD';
    if (stored in CURRENCIES) setCurrencyState(stored as CurrencyCode);

    // Fetch exchange rates
    fetch(`${API_URL}/api/v1/currency/rates`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: unknown) => {
        const payload = (data as { data?: Record<string, number> })?.data ?? data as Record<string, number>;
        if (payload && typeof payload === 'object') setRates(payload);
      })
      .catch(() => { /* use fallback { USD: 1 } */ })
      .finally(() => setIsLoading(false));
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    if (!(code in CURRENCIES)) return;
    setCurrencyState(code);
    localStorage.setItem(CURRENCY_LS_KEY, code);
    document.cookie = `${CURRENCY_COOKIE}=${code};path=/;max-age=31536000;SameSite=Lax`;
  };

  const format = (usdAmount: number): string => {
    const cfg      = CURRENCIES[currency] ?? CURRENCIES.USD;
    const rate     = rates[currency] ?? 1;
    const converted = usdAmount * rate;
    const tilde    = currency !== 'USD' ? '~' : '';

    if (currency === 'VND') {
      return `${tilde}${cfg.symbol}${Math.round(converted).toLocaleString('vi-VN')}`;
    }

    return `${tilde}${cfg.symbol}${converted.toFixed(cfg.decimals)}`;
  };

  const symbol = (CURRENCIES[currency] ?? CURRENCIES.USD).symbol;

  return (
    <CurrencyContext.Provider value={{ currency, symbol, rates, setCurrency, format, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
