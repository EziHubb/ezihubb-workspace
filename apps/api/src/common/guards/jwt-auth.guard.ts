import { ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Skip auth for routes decorated with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser, info: Error | undefined): TUser {
    if (err) {
      this.logger.debug(`JWT validation error: ${err.message}`, err.stack);
    }
    if (info) {
      this.logger.debug(`JWT strategy info: ${info.message}`);
    }
    if (err || !user) {
      throw new UnauthorizedException({
        code: 'ERR_UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid access token.',
      });
    }
    return user;
  }
}
