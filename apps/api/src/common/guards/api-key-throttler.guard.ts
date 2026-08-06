import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Tracks rate limits per API key rather than per-IP, so one seller's automation
 * traffic can't exhaust another seller's quota (and scripted callers behind a
 * shared/NAT'd IP don't throttle each other).
 */
@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.apiKey?.id ?? req.ip;
  }
}
