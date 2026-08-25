import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Auth is optional — attaches the user when a valid JWT is provided, and lets
 * a request with NO token through unauthenticated.
 *
 * A token that is present but expired or malformed is a different case, and
 * conflating the two cost a real bug: this used to return `undefined` for both,
 * so an expired session looked exactly like a guest. On a route that then
 * refused the guest — deleting your own conversation, say — the caller got a
 * 403, and the client only refreshes its token on a 401. The session was
 * recoverable the whole time and nothing tried, so the button stayed broken
 * until the page was reloaded.
 *
 * Saying 401 when a token was offered and rejected is both the honest answer
 * and the one that lets the client fix itself.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser>(_err: unknown, user: TUser, _info: unknown, context: ExecutionContext): TUser {
    if (user) return user;

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;

    // Only a Bearer header counts as "a token was offered". Anything else —
    // absent, or some other scheme we do not issue — is treated as a guest,
    // which is what keeps guest access working.
    if (header?.startsWith('Bearer ') && header.length > 'Bearer '.length) {
      throw new UnauthorizedException({
        code:    'ERR_TOKEN_INVALID',
        message: 'Your session has expired. Please sign in again.',
      });
    }

    return user;
  }
}
