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
    const { method, url, ip } = req;
    const userAgent = req.headers['user-agent'] ?? '';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${url} ${res.statusCode} ${duration}ms — ${ip} ${userAgent} [${req.requestId ?? '-'}]`,
          );
        },
        error: (error: { status?: number; message?: string }) => {
          const duration = Date.now() - start;
          this.logger.error(
            `${method} ${url} ${error.status ?? 500} ${duration}ms — ${ip} [${req.requestId ?? '-'}] ${error.message ?? ''}`,
          );
        },
      }),
    );
  }
}
