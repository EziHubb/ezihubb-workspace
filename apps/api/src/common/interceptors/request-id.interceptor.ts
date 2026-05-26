import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Observable } from 'rxjs';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const response = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();

    // Honour forwarded request ID from client/proxy, otherwise generate one
    const requestId =
      (request['headers'] as Record<string, string>)?.['x-request-id'] ??
      `req_${randomBytes(8).toString('hex')}`;

    request['requestId'] = requestId;
    response.setHeader('X-Request-ID', requestId);

    return next.handle();
  }
}
