import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RefreshPayload {
  userId: string;
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async validate(req: Request): Promise<RefreshPayload> {
    const rawToken: string | undefined = req.cookies?.['refresh_token'];

    if (!rawToken) {
      throw new UnauthorizedException({ code: 'ERR_REFRESH_TOKEN_INVALID' });
    }

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      include: { user: { select: { id: true, deletedAt: true } } },
    });

    if (!stored || stored.user.deletedAt) {
      throw new UnauthorizedException({ code: 'ERR_REFRESH_TOKEN_INVALID' });
    }

    return { userId: stored.userId, refreshToken: rawToken };
  }
}
