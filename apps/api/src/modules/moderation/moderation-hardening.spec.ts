import { TextModerationService } from './text-moderation.service';
import { ImageModerationService } from './image-moderation.service';
import { ModerationService } from './moderation.service';
jest.mock('../../common/services/anthropic.service', () => ({ AnthropicService: class {}, DEFAULT_ANTHROPIC_MODEL: 'test-model' }));

describe('Unknown moderation is not approval', () => {
  afterEach(() => jest.restoreAllMocks());
  it('text provider timeout rejects without a fabricated CLEAN result', async () => {
    const service = new TextModerationService({ jsonWithUsage: async () => { throw new Error('timeout'); } } as never);
    await expect(service.checkText('content')).rejects.toThrow('Text moderation unavailable');
  });
  it.each([{}, { verdict: 'CLEAN' }, { verdict: 'CLEAN', categories: [], confidence: NaN, reasoning: null, sellerMessage: null }])('rejects malformed model verdict %j', async (data) => {
    const service = new TextModerationService({ jsonWithUsage: async () => ({ data, usage: { costUsd: 0.1 } }) } as never);
    await expect(service.checkText('content')).rejects.toThrow();
  });
  it('preserves a valid verdict and provider-reported cost', async () => {
    const data = { verdict: 'CLEAN', categories: [], confidence: 0.95, reasoning: null, sellerMessage: null };
    const service = new TextModerationService({ jsonWithUsage: async () => ({ data, usage: { costUsd: 0.1 } }) } as never);
    await expect(service.checkText('content')).resolves.toMatchObject({ ...data, costUsd: 0.1 });
  });
  it.each(['download', 'oversize', 'provider'])('image %s failure is not CLEAN', async (failure) => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      if (failure === 'download') throw new Error('timeout');
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(failure === 'oversize' ? 6 * 1024 * 1024 : 1), headers: new Headers() } as Response;
    });
    const provider = { jsonWithUsage: jest.fn().mockRejectedValue(new Error('provider down')) };
    await expect(new ImageModerationService(provider as never).checkImage('https://example.test/image')).rejects.toThrow();
    if (failure !== 'provider') expect(provider.jsonWithUsage).not.toHaveBeenCalled();
  });
  it.each(['checkText', 'checkImage'] as const)('budget exhaustion fails %s visibly without storing CLEAN', async (method) => {
    const service = Object.create(ModerationService.prototype) as ModerationService;
    const saveAndApply = jest.fn();
    Object.assign(service, { getCachedSettings: async () => ({ isEnabled: true, moderateImages: true, maxDailyApiCalls: 1 }),
      redis: { get: async (key: string) => key.includes('calls') ? '1' : null }, saveAndApply, logger: { warn: jest.fn() } });
    await expect(service[method]({ entityType: 'product', entityId: 'p', fieldName: 'name', content: 'text', imageUrl: 'https://example.test/image' })).rejects.toThrow();
    expect(saveAndApply).not.toHaveBeenCalled();
  });
});
