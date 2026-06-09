import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/services/redis.service';

const SUPPORTED = ['USD', 'EUR', 'GBP', 'CAD', 'VND'] as const;
const CACHE_KEY = 'exchange-rates:usd-base';
const CACHE_TTL = 24 * 60 * 60; // 24h

export type SupportedCurrency = (typeof SUPPORTED)[number];

export interface ExchangeRates {
  USD: number;
  EUR: number;
  GBP: number;
  CAD: number;
  VND: number;
  [key: string]: number;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(private readonly redis: RedisService) {}

  async getRates(): Promise<ExchangeRates> {
    const cached = await this.redis.get<ExchangeRates>(CACHE_KEY);
    if (cached) return cached;

    try {
      const url      = 'https://open.er-api.com/v6/latest/USD';
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });

      if (!response.ok) {
        this.logger.warn(`Exchange rate API returned ${response.status} — using fallback`);
        return this.getFallbackRates();
      }

      const data   = await response.json() as { rates: Record<string, number> };
      const rates: Record<string, number> = { USD: 1 };

      for (const currency of SUPPORTED) {
        if (data.rates[currency]) {
          rates[currency] = data.rates[currency];
        }
      }

      await this.redis.set(CACHE_KEY, rates, CACHE_TTL);
      this.logger.log(`Exchange rates refreshed: ${JSON.stringify(rates)}`);
      return rates as ExchangeRates;
    } catch (err) {
      this.logger.warn(`Exchange rate fetch failed (${(err as Error).message}) — using fallback`);
      return this.getFallbackRates();
    }
  }

  private getFallbackRates(): ExchangeRates {
    return { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.37, VND: 25450 };
  }

  getSupportedCurrencies() {
    return [
      { code: 'USD', symbol: '$',   name: 'US Dollar',       flag: '🇺🇸' },
      { code: 'EUR', symbol: '€',   name: 'Euro',            flag: '🇪🇺' },
      { code: 'GBP', symbol: '£',   name: 'British Pound',   flag: '🇬🇧' },
      { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦' },
      { code: 'VND', symbol: '₫',   name: 'Vietnamese Dong', flag: '🇻🇳' },
    ];
  }
}
