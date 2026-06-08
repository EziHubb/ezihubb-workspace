import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Unsubscribe')
@Controller('unsubscribe')
@SkipThrottle()
export class UnsubscribeController {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {}

  @Get('cart')
  @ApiOperation({ summary: 'Opt out of abandoned-cart reminder emails' })
  @ApiQuery({ name: 'token', required: true })
  async unsubscribeCart(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    if (token) {
      const user = await this.prisma.user.findFirst({
        where: { cartEmailToken: token },
        select: { id: true },
      });
      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data:  { cartEmailOptOut: true },
        });
      }
    }

    res.redirect(`${frontendUrl}/pages/unsubscribed?type=cart`);
  }
}
