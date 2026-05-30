import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';

// Conditionally import Sentry so the API works without it configured
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Sentry: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require('@sentry/node');
} catch {
  // @sentry/node not installed — monitoring disabled
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string; user?: { id: string } }>();

    const meta = {
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    };

    // ── ThrottlerException → ERR_RATE_LIMIT ───────────────────────────────────
    if (exception instanceof ThrottlerException) {
      const ext = exception as ThrottlerException & { retryAfter?: number };
      response.status(429).json({
        success: false,
        error: {
          code: 'ERR_RATE_LIMIT',
          message: 'Too many requests. Please try again later.',
          details: [{ retryAfter: ext.retryAfter ?? 60 }],
        },
        meta,
      });
      return;
    }

    // ── HttpException ─────────────────────────────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as Record<string, unknown>;

      // Validation pipe produces an array of messages
      if (Array.isArray(exceptionResponse['message'])) {
        response.status(status).json({
          success: false,
          error: {
            code: 'ERR_VALIDATION',
            message: 'Validation failed.',
            details: (exceptionResponse['message'] as string[]).map((msg) => ({
              field: msg.split(' ')[0],
              message: msg,
            })),
          },
          meta,
        });
        return;
      }

      response.status(status).json({
        success: false,
        error: {
          code:
            (exceptionResponse['code'] as string) ||
            (exceptionResponse['error'] as string) ||
            'ERR_INTERNAL',
          message:
            (exceptionResponse['message'] as string) || 'An error occurred.',
          details: (exceptionResponse['details'] as unknown[]) ?? [],
        },
        meta,
      });
      return;
    }

    // ── Unknown / unhandled errors — capture to Sentry ────────────────────────
    this.logger.error(
      `Unhandled exception [${request.requestId}]: ${(exception as Error)?.message ?? String(exception)}`,
      (exception as Error)?.stack,
    );

    if (Sentry && process.env['SENTRY_DSN']) {
      Sentry.withScope((scope: any) => {
        scope.setTag('requestId', request.requestId ?? 'unknown');
        scope.setTag('path', request.path);
        scope.setTag('method', request.method);
        if (request.user?.id) {
          scope.setUser({ id: request.user.id });
        }
        Sentry!.captureException(exception);
      });
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'ERR_INTERNAL',
        message: 'Internal server error.',
        details: [],
      },
      meta,
    });
  }
}
