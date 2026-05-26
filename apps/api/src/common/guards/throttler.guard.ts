import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: { ttl: number; limit: number; remainingPoints?: number },
  ): Promise<void> {
    const res = context.switchToHttp().getResponse<Response>();
    const req = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    const retryAfter = Math.ceil(throttlerLimitDetail.ttl / 1000);

    res.setHeader('Retry-After', retryAfter);
    res.setHeader('X-RateLimit-Limit', throttlerLimitDetail.limit);
    res.setHeader('X-RateLimit-Remaining', 0);

    // Throw so HttpExceptionFilter can format the response envelope correctly
    throw Object.assign(new ThrottlerException(), {
      requestId: req.requestId,
      retryAfter,
    });
  }
}
