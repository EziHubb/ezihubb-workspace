import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { getAllowedOrigins, getConfiguredOrigins, isWildcardOrigin } from '../utils/allowed-origins.util';

/**
 * Defense-in-depth CSRF mitigation for endpoints authenticated solely via the
 * httpOnly refresh_token cookie (e.g. POST /auth/refresh). That cookie is set
 * with `sameSite: 'none'` in production (required since admin/client live on
 * different subdomains from the API), so it IS attached to cross-site
 * requests — CORS alone doesn't stop this, since CORS only blocks a
 * cross-origin script from *reading the response*, not from *sending the
 * request* in the first place (e.g. a bare cross-site <form> POST or
 * fetch(..., {mode:'no-cors'}) still fires). Validating Origin (falling back
 * to Referer) against the same whitelist CORS uses closes that gap.
 */
@Injectable()
export class OriginCheckGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (isWildcardOrigin(getConfiguredOrigins())) return true; // dev mode — CORS itself is wide open too

    const origin = req.headers.origin ?? refererToOrigin(req.headers.referer);
    if (!origin) {
      // No Origin/Referer at all — not a browser cross-site request (curl, server-to-server). Allow.
      return true;
    }

    if (!getAllowedOrigins().has(origin)) {
      throw new ForbiddenException({ code: 'ERR_ORIGIN_NOT_ALLOWED', message: 'Request origin not allowed' });
    }
    return true;
  }
}

function refererToOrigin(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    const url = new URL(referer);
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}
