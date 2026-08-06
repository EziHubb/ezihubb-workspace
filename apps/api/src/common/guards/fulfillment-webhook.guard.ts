import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { FulfillmentConnectionStatus, FulfillmentProviderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../services/encryption.service';

export interface FulfillmentWebhookRequest extends Request {
  fulfillmentConnection: {
    id:             string;
    externalShopId: string;
    provider:       FulfillmentProviderType;
  };
}

/**
 * Provider-agnostic webhook guard. The URL always carries an opaque
 * per-connection token (`/webhooks/:provider/:token` — `:provider` is purely
 * cosmetic/for readability, lookup is by token alone), which is how Printify
 * webhooks are authenticated (it has no signing mechanism at all — verified
 * against their OpenAPI spec).
 *
 * Merchize *does* have a shared-secret mechanism (a `merchize-webhook-key`
 * header that must match a secret the seller generates in their dashboard),
 * so for MERCHIZE connections this guard additionally verifies that header
 * as a second layer on top of the URL token.
 */
@Injectable()
export class FulfillmentWebhookGuard implements CanActivate {
  constructor(
    private readonly prisma:     PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FulfillmentWebhookRequest>();
    const token = req.params['token'];
    if (!token) throw new UnauthorizedException('Missing webhook token');

    const connection = await this.prisma.storeFulfillmentConnection.findUnique({
      where:  { webhookToken: token },
      select: { id: true, externalShopId: true, status: true, provider: true, encryptedWebhookSecret: true },
    });
    if (!connection || connection.status !== FulfillmentConnectionStatus.ACTIVE) {
      throw new UnauthorizedException('Unknown or inactive webhook token');
    }

    if (connection.provider === FulfillmentProviderType.MERCHIZE) {
      const headerSecret = req.headers['merchize-webhook-key'];
      const expected = connection.encryptedWebhookSecret
        ? this.encryption.decrypt(connection.encryptedWebhookSecret)
        : null;
      if (!expected || headerSecret !== expected) {
        throw new UnauthorizedException('Invalid or missing merchize-webhook-key header');
      }
    }

    req.fulfillmentConnection = {
      id:             connection.id,
      externalShopId: connection.externalShopId,
      provider:       connection.provider,
    };
    return true;
  }
}
