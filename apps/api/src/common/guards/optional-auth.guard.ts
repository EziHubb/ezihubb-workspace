import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Auth is optional — attaches the user to request if a valid JWT is provided,
 * but does NOT reject requests without one.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // Never throw — return user if present, undefined otherwise
  handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
