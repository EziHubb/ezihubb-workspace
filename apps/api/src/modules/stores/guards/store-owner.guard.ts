import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class StoreOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const userId = user?.sub ?? user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isSeller: true,
        storeId: true,
        ownedStore: true,
      },
    });

    if (!dbUser?.isSeller || !dbUser.ownedStore) {
      throw new ForbiddenException({ code: 'ERR_NOT_SELLER', message: 'You do not have a seller account' });
    }

    const store = dbUser.ownedStore;

    if (store.status === 'PENDING') {
      throw new ForbiddenException({ code: 'ERR_STORE_PENDING', message: 'Your store application is under review' });
    }
    if (store.status === 'REJECTED') {
      throw new ForbiddenException({ code: 'ERR_STORE_REJECTED', message: 'Your store application was rejected' });
    }
    if (store.status === 'SUSPENDED') {
      throw new ForbiddenException({ code: 'ERR_STORE_SUSPENDED', message: 'Your store has been suspended' });
    }
    if (store.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: 'ERR_STORE_INACTIVE', message: 'Store is not active' });
    }

    request.store = store;
    return true;
  }
}
