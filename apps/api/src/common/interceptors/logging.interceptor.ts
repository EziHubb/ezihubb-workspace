import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    const { method } = req;
    // Route templates contain neither query tokens nor resource identifiers.
    // Do not log raw URL, IP, user agent, or provider exception messages.
    const route = typeof req.route?.path === 'string' ? req.route.path : '[unmatched-route]';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${route} ${res.statusCode} ${duration}ms [${req.requestId ?? '-'}]`,
          );
        },
        error: (error: { status?: number; message?: string }) => {
          const duration = Date.now() - start;
          this.logger.error(
            `${method} ${route} ${error.status ?? 500} ${duration}ms [${req.requestId ?? '-'}] REQUEST_FAILED`,
          );
        },
      }),
    );
  }
}
