import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { FulfillmentConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface PrintifyWebhookRequest extends Request {
  fulfillmentConnection: { id: string; externalShopId: string };
}

/**
 * Printify's public API has no webhook signature/secret mechanism (verified
 * against their OpenAPI spec — no "secret" or "signature" concept exists
 * anywhere in it). Security here relies instead on an unguessable per-connection
 * token embedded directly in the registered callback URL
 * (POST /webhooks/printify/:token) — this guard's only job is to resolve that
 * token back to an active connection, or reject the request.
 */
@Injectable()
export class PrintifyWebhookGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PrintifyWebhookRequest>();
    const token = req.params['token'];
    if (!token) throw new UnauthorizedException('Missing webhook token');

    const connection = await this.prisma.storeFulfillmentConnection.findUnique({
      where:  { webhookToken: token },
      select: { id: true, externalShopId: true, status: true },
    });
    if (!connection || connection.status !== FulfillmentConnectionStatus.ACTIVE) {
      throw new UnauthorizedException('Unknown or inactive webhook token');
    }

    req.fulfillmentConnection = connection;
    return true;
  }
}
