import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyService, ExchangeRates } from './currency.service';
import { RedisService } from '../../common/services/redis.service';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
};

// We spy on global fetch to simulate the external exchange-rate API
const mockFetch = jest.fn();

describe('CurrencyService', () => {
  let service: CurrencyService;

  const cachedRates: ExchangeRates = {
    USD: 1,
    EUR: 0.91,
    GBP: 0.78,
    CAD: 1.36,
    VND: 25300,
  };

  const apiRates: ExchangeRates = {
    USD: 1,
    EUR: 0.93,
    GBP: 0.80,
    CAD: 1.38,
    VND: 25600,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);

    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  // ─── getRates ─────────────────────────────────────────────────────────────────

  describe('getRates', () => {
    it('returns cached rates when Redis hit (no fetch call)', async () => {
      mockRedis.get.mockResolvedValue(cachedRates);

      const result = await service.getRates();

      expect(result).toEqual(cachedRates);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches from external API and caches result when Redis miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ rates: apiRates }),
      } as unknown as Response);

      const result = await service.getRates();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://open.er-api.com/v6/latest/USD',
        expect.any(Object),
      );
      expect(result.EUR).toBe(apiRates.EUR);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'exchange-rates:usd-base',
        expect.objectContaining({ USD: 1 }),
        86400,
      );
    });

    it('returns fallback rates when API responds with non-OK status', async () => {
      mockRedis.get.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
      } as unknown as Response);

      const result = await service.getRates();

      // Fallback rates are hardcoded; USD must always be 1
      expect(result.USD).toBe(1);
      expect(result).toHaveProperty('EUR');
      expect(result).toHaveProperty('GBP');
    });

    it('returns fallback rates when fetch throws (network error)', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('network timeout'));

      const result = await service.getRates();

      expect(result.USD).toBe(1);
      expect(result).toHaveProperty('VND');
    });
  });

  // ─── convert ─────────────────────────────────────────────────────────────────
  // CurrencyService does not expose a convert() method directly — conversion
  // is computed client-side via the rates returned by getRates().
  // The tests below verify the rate multiplier logic directly on the returned rates.

  describe('rate multiplier (convert)', () => {
    it('applies EUR rate correctly against a USD base amount', async () => {
      mockRedis.get.mockResolvedValue(cachedRates);

      const rates = await service.getRates();
      const usdAmount = 100;
      const converted = usdAmount * rates.EUR;

      expect(converted).toBeCloseTo(91, 0);
    });

    it('applies VND rate correctly against a USD base amount', async () => {
      mockRedis.get.mockResolvedValue(cachedRates);

      const rates = await service.getRates();
      const usdAmount = 10;
      const converted = usdAmount * rates.VND;

      expect(converted).toBeCloseTo(253000, -2);
    });

    it('USD-to-USD conversion is always 1:1', async () => {
      mockRedis.get.mockResolvedValue(cachedRates);

      const rates = await service.getRates();
      const usdAmount = 50;

      expect(usdAmount * rates.USD).toBe(50);
    });
  });
});
