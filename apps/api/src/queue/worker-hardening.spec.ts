import { ImageProcessor } from './image.processor';
import { reportDeadJob } from './dead-job-alert';
import { JOBS } from './queue.constants';
import axios from 'axios';
jest.mock('replicate', () => ({ __esModule: true, default: class {} }));
jest.mock('axios');

describe('Worker failure truth and diagnostics', () => {
  it.each(['missing-key', 'provider-timeout', 'storage-failure'])('does not return original image as completed on %s', async (failure) => {
    const uploadFile = jest.fn().mockRejectedValue(new Error('storage unavailable'));
    const processor = new ImageProcessor({ get: (key: string) => key === 'BG_REMOVAL_API_KEY' && failure !== 'missing-key' ? 'test-only-key' : '' } as never,
      { getPublicUrl: () => 'https://example.test/original', uploadFile } as never, {} as never, {} as never);
    if (failure === 'storage-failure') jest.mocked(axios.post).mockResolvedValueOnce({ data: new ArrayBuffer(1), headers: {} });
    else jest.mocked(axios.post).mockRejectedValueOnce(new Error('timeout'));
    await expect(processor.process({ name: JOBS.REMOVE_BACKGROUND, data: { uploadKey: 'input', outputKey: 'output' } } as never)).rejects.toThrow();
    if (failure !== 'storage-failure') expect(uploadFile).not.toHaveBeenCalled();
    jest.mocked(axios.post).mockReset();
  });
  it('keeps correlation but never logs or emails job payload/error secrets', async () => {
    const logger = { error: jest.fn() };
    const emailQueue = { add: jest.fn().mockResolvedValue({}) };
    await reportDeadJob({ name: JOBS.CONFIRM_STORE_ORDERS, id: 'correlation-id', queueName: 'orders', attemptsMade: 3, opts: { attempts: 3 },
      data: { accessToken: 'SECRET-CANARY', email: 'PII-CANARY' } } as never, new Error('SECRET-CANARY PII-CANARY'), { logger: logger as never, emailQueue: emailQueue as never });
    const emitted = JSON.stringify([logger.error.mock.calls, emailQueue.add.mock.calls]);
    expect(emitted).toContain('correlation-id');
    expect(emitted).not.toContain('SECRET-CANARY');
    expect(emitted).not.toContain('PII-CANARY');
  });
});
