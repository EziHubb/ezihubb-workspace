import { ArgumentsHost, Catch, ExceptionFilter, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';

/**
 * Without this, a denied/failed Google consent throws UnauthorizedException
 * from the `AuthGuard('google')` before the route handler ever runs, so the
 * browser lands on a raw JSON error response instead of back on the client's
 * OAuth callback page (which already knows how to show a friendly error via
 * ?error=oauth_failed).
 */
@Catch(UnauthorizedException)
export class GoogleAuthExceptionFilter implements ExceptionFilter {
  catch(_exception: UnauthorizedException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/google/callback?error=oauth_failed`);
  }
}
