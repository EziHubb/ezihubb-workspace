import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { FulfillmentConnectionStatus, FulfillmentProviderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { FulfillmentRegistryService } from './fulfillment-registry.service';
import { DecryptedConnection, ShopProductSummary } from './interfaces/fulfillment-provider.interface';

const CONNECTION_LIST_SELECT = {
  id:               true,
  storeId:          true,
  provider:         true,
  status:           true,
  externalShopId:   true,
  externalShopName: true,
  lastVerifiedAt:   true,
  lastErrorMessage: true,
  createdAt:        true,
  updatedAt:        true,
  // encryptedApiKey / webhookToken / externalWebhookIds intentionally excluded
} as const;

@Injectable()
export class FulfillmentConnectionsService {
  private readonly logger = new Logger(FulfillmentConnectionsService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly encryption: EncryptionService,
    private readonly registry:   FulfillmentRegistryService,
  ) {}

  private webhookBaseUrl(): string {
    const apiUrl = process.env.API_URL ?? 'http://localhost:3002';
    return `${apiUrl}/api/v1/webhooks/printify`;
  }

  async listForStore(storeId: string) {
    return this.prisma.storeFulfillmentConnection.findMany({
      where:  { storeId },
      select: CONNECTION_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async connect(storeId: string, provider: FulfillmentProviderType, apiKey: string, externalShopId: string) {
    const existing = await this.prisma.storeFulfillmentConnection.findUnique({
      where: { storeId_provider: { storeId, provider } },
    });
    if (existing && existing.status === FulfillmentConnectionStatus.ACTIVE) {
      throw new BadRequestException('This store already has an active connection for this provider — disconnect it first');
    }

    const providerImpl = this.registry.resolve(provider);
    const { shopName } = await providerImpl.verifyConnection(apiKey, externalShopId);

    const webhookToken = randomBytes(32).toString('hex');
    const callbackUrl  = `${this.webhookBaseUrl()}/${webhookToken}`;

    let externalWebhookIds: string[] = [];
    try {
      const registration = await providerImpl.registerWebhooks(
        { connectionId: existing?.id ?? 'pending', apiKey, externalShopId },
        callbackUrl,
      );
      externalWebhookIds = registration.externalWebhookIds;
    } catch (err) {
      this.logger.error(`Failed to register Printify webhooks for shop ${externalShopId}: ${(err as Error).message}`);
      throw new BadRequestException('Connected, but failed to register status webhooks — please try again');
    }

    const encryptedApiKey = this.encryption.encrypt(apiKey);
    const data = {
      storeId,
      provider,
      status:             FulfillmentConnectionStatus.ACTIVE,
      externalShopId,
      externalShopName:   shopName,
      encryptedApiKey,
      webhookToken,
      externalWebhookIds,
      lastVerifiedAt:     new Date(),
      lastErrorMessage:   null,
    };

    const connection = existing
      ? await this.prisma.storeFulfillmentConnection.update({ where: { id: existing.id }, data })
      : await this.prisma.storeFulfillmentConnection.create({ data });

    return { id: connection.id, provider: connection.provider, externalShopId, externalShopName: shopName };
  }

  async disconnect(storeId: string, connectionId: string): Promise<void> {
    const connection = await this.prisma.storeFulfillmentConnection.findFirst({
      where: { id: connectionId, storeId },
    });
    if (!connection) throw new NotFoundException('Connection not found');

    if (connection.externalWebhookIds.length > 0) {
      const providerImpl = this.registry.resolve(connection.provider);
      const decrypted = this.decryptFor(connection);
      await providerImpl.unregisterWebhooks(decrypted, connection.externalWebhookIds).catch((err: Error) =>
        this.logger.warn(`Failed to unregister webhooks on disconnect: ${err.message}`),
      );
    }

    // Soft-disconnect — keep the row (and any StoreOrderFulfillment history referencing it) for audit purposes.
    await this.prisma.storeFulfillmentConnection.update({
      where: { id: connectionId },
      data:  { status: FulfillmentConnectionStatus.DISCONNECTED, externalWebhookIds: [] },
    });
  }

  async listShopProducts(storeId: string, connectionId: string): Promise<ShopProductSummary[]> {
    const connection = await this.prisma.storeFulfillmentConnection.findFirst({
      where: { id: connectionId, storeId, status: FulfillmentConnectionStatus.ACTIVE },
    });
    if (!connection) throw new NotFoundException('Active connection not found');

    const providerImpl = this.registry.resolve(connection.provider);
    return providerImpl.listShopProducts(this.decryptFor(connection));
  }

  /** Internal — used by the fulfillment queue processor, checkout, and webhook handler. */
  async getDecryptedConnection(connectionId: string): Promise<DecryptedConnection & { provider: FulfillmentProviderType }> {
    const connection = await this.prisma.storeFulfillmentConnection.findUniqueOrThrow({ where: { id: connectionId } });
    return { ...this.decryptFor(connection), provider: connection.provider };
  }

  private decryptFor(connection: { id: string; encryptedApiKey: string; externalShopId: string }): DecryptedConnection {
    return {
      connectionId:   connection.id,
      apiKey:         this.encryption.decrypt(connection.encryptedApiKey),
      externalShopId: connection.externalShopId,
    };
  }
}
