import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers['x-api-key'];

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { store: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    const store = apiKey.store;

    if (store.status === 'SUSPENDED') {
      throw new ForbiddenException({ code: 'ERR_STORE_SUSPENDED', message: 'Your store has been suspended' });
    }
    if (store.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: 'ERR_STORE_INACTIVE', message: 'Store is not active' });
    }

    request.store = store;
    request.apiKey = apiKey;

    // Fire-and-forget — don't block the request on this write.
    void this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => undefined);

    return true;
  }
}
