import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/services/redis.service';

export interface TaxCalculation {
  taxAmount:    number;
  taxRate:      number;
  jurisdiction: string;
  breakdown?: {
    stateTax:   number;
    countyTax:  number;
    cityTax:    number;
    specialTax: number;
  };
}

interface TaxJarLineItem {
  id:                string;
  quantity:          number;
  unit_price:        number;
  product_tax_code?: string;
}

interface TaxJarParams {
  from_country: string;
  from_zip:     string;
  from_state:   string;
  to_country:   string;
  to_zip:       string;
  to_state:     string;
  amount:       number;
  shipping:     number;
  line_items?:  TaxJarLineItem[];
}

interface TaxJarResponse {
  tax: {
    amount_to_collect: number;
    rate:              number;
    has_nexus:         boolean;
    jurisdictions?:    { state?: string };
    breakdown?: {
      state_tax_collectable?:            number;
      county_tax_collectable?:           number;
      city_tax_collectable?:             number;
      special_district_tax_collectable?: number;
    };
  };
}

interface TaxJarClient {
  taxForOrder(params: TaxJarParams): Promise<TaxJarResponse>;
}

// Average state tax rates — fallback only, not compliance-grade
const STATE_RATES: Record<string, number> = {
  AL: 0.04,   AK: 0,      AZ: 0.056,  AR: 0.065,  CA: 0.0725,
  CO: 0.029,  CT: 0.0635, DE: 0,      FL: 0.06,   GA: 0.04,
  HI: 0.04,   ID: 0.06,   IL: 0.0625, IN: 0.07,   IA: 0.06,
  KS: 0.065,  KY: 0.06,   LA: 0.0445, ME: 0.055,  MD: 0.06,
  MA: 0.0625, MI: 0.06,   MN: 0.06875,MS: 0.07,   MO: 0.04225,
  MT: 0,      NE: 0.055,  NV: 0.0685, NH: 0,      NJ: 0.06625,
  NM: 0.05125,NY: 0.08,   NC: 0.0475, ND: 0.05,   OH: 0.0575,
  OK: 0.045,  OR: 0,      PA: 0.06,   RI: 0.07,   SC: 0.06,
  SD: 0.045,  TN: 0.07,   TX: 0.0625, UT: 0.0485, VT: 0.06,
  VA: 0.043,  WA: 0.065,  WV: 0.06,   WI: 0.05,   WY: 0.04,
};

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);
  private readonly client: TaxJarClient | null = null;
  private readonly fromZip:   string;
  private readonly fromState: string;

  constructor(
    private readonly config: ConfigService,
    private readonly redis:  RedisService,
  ) {
    const apiKey = config.get<string>('TAXJAR_API_KEY', '');
    this.fromZip   = config.get<string>('BUSINESS_ZIP',   '10001');
    this.fromState = config.get<string>('BUSINESS_STATE', 'NY');

    if (apiKey) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-call
      const TaxJarConstructor = require('taxjar') as new (opts: { apiKey: string }) => TaxJarClient;
      this.client = new TaxJarConstructor({ apiKey });
      this.logger.log('TaxJar client initialised');
    } else {
      this.logger.warn('TAXJAR_API_KEY not set — using flat-rate fallback for US tax');
    }
  }

  async calculateTax(params: {
    toZip:     string;
    toState:   string;
    toCountry: string;
    subtotal:  number;
    shipping:  number;
    lineItems?: { id: string; quantity: number; unitPrice: number }[];
  }): Promise<TaxCalculation> {
    if (params.toCountry !== 'US') {
      return { taxAmount: 0, taxRate: 0, jurisdiction: params.toCountry };
    }

    const cacheKey = `tax:${params.toState}:${params.toZip}:${Math.round(params.subtotal * 100)}:${Math.round(params.shipping * 100)}`;
    const cached = await this.redis.get<TaxCalculation>(cacheKey);
    if (cached) return cached;

    if (!this.client) {
      return this.flatRateFallback(params.toState, params.subtotal, params.shipping);
    }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TaxJar request timed out after 8s')), 8_000),
    );

    try {
      const response = await Promise.race([this.client.taxForOrder({
        from_country: 'US',
        from_zip:     this.fromZip,
        from_state:   this.fromState,
        to_country:   params.toCountry,
        to_zip:       params.toZip,
        to_state:     params.toState,
        amount:       params.subtotal,
        shipping:     params.shipping,
        line_items:   params.lineItems?.map((item) => ({
          id:               item.id,
          quantity:         item.quantity,
          unit_price:       item.unitPrice,
          product_tax_code: '81100', // General handmade/apparel POD
        })),
      }), timeout]);

      const { tax } = response;
      const result: TaxCalculation = {
        taxAmount:    Math.round(tax.amount_to_collect * 100) / 100,
        taxRate:      tax.rate,
        jurisdiction: tax.jurisdictions?.state ?? params.toState,
        breakdown: {
          stateTax:   tax.breakdown?.state_tax_collectable            ?? 0,
          countyTax:  tax.breakdown?.county_tax_collectable           ?? 0,
          cityTax:    tax.breakdown?.city_tax_collectable             ?? 0,
          specialTax: tax.breakdown?.special_district_tax_collectable ?? 0,
        },
      };

      await this.redis.set(cacheKey, result, 3600);
      return result;

    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      this.logger.error(`TaxJar calculation failed: ${msg} — using flat-rate fallback`);
      // NEVER block checkout due to tax failures — graceful fallback
      return this.flatRateFallback(params.toState, params.subtotal, params.shipping);
    }
  }

  private flatRateFallback(state: string, subtotal: number, shipping: number): TaxCalculation {
    const rate      = STATE_RATES[state.toUpperCase()] ?? 0.07;
    const taxable   = subtotal + shipping;
    const taxAmount = Math.round(taxable * rate * 100) / 100;
    return { taxAmount, taxRate: rate, jurisdiction: state };
  }
}
