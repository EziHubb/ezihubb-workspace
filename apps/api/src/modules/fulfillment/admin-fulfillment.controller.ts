import { Body, Delete, Get, Param, Post, Put, Query, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { FulfillmentProviderType, StoreFulfillmentMode } from '@prisma/client';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreContextService } from '../../common/services/store-context.service';
import { FulfillmentConnectionsService } from './fulfillment-connections.service';

const STORE_ID_DESC = 'Required only when managing platform-wide (SUPER_ADMIN, no store switched into) — which store to act on. Ignored for a scoped caller, who always acts on their own store.';

class ConnectProviderDto {
  @ApiProperty({ enum: FulfillmentProviderType })
  @IsIn(Object.values(FulfillmentProviderType))
  provider: FulfillmentProviderType;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  apiKey: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  externalShopId: string;

  @ApiPropertyOptional({ description: STORE_ID_DESC })
  @IsOptional()
  @IsString()
  storeId?: string;
}

class SetWebhookSecretDto {
  @ApiProperty({ description: "The secret key generated in the provider's own dashboard (e.g. Merchize's Settings → Webhook → Add secret Key)" })
  @IsString()
  @MaxLength(500)
  secret: string;

  @ApiPropertyOptional({ description: STORE_ID_DESC })
  @IsOptional()
  @IsString()
  storeId?: string;
}

class SetFulfillmentModeDto {
  @ApiProperty({
    enum: StoreFulfillmentMode,
    description: 'AUTOMATIC pushes mapped products to a connected provider (Printify/Merchize). MANUAL means the store ships every order itself — the queue never auto-pushes, regardless of any existing mappings.',
  })
  @IsIn(Object.values(StoreFulfillmentMode))
  mode: StoreFulfillmentMode;

  @ApiPropertyOptional({ description: STORE_ID_DESC })
  @IsOptional()
  @IsString()
  storeId?: string;
}

class SaveMappingDto {
  @ApiProperty()
  @IsString()
  connectionId: string;

  @ApiProperty()
  @IsString()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty()
  @IsString()
  externalProductId: string;

  @ApiProperty()
  @IsString()
  externalVariantId: string;

  @ApiPropertyOptional({ description: STORE_ID_DESC })
  @IsOptional()
  @IsString()
  storeId?: string;
}

@AdminController('fulfillment')
export class AdminFulfillmentController {
  constructor(
    private readonly connections:  FulfillmentConnectionsService,
    private readonly prisma:       PrismaService,
    private readonly storeContext: StoreContextService,
  ) {}

  /** Resolves which store to act on — ambient for a scoped caller, explicit `storeId` required for a platform-context SUPER_ADMIN. */
  private async resolveStoreId(req: Request, storeId?: string): Promise<string> {
    const context = await this.storeContext.resolve(req);
    return this.storeContext.resolveTargetStoreId(context, storeId);
  }

  @Get('mode')
  @ApiOperation({ summary: "Get a store's fulfillment mode (AUTOMATIC via a connected provider, or MANUAL self-fulfillment)" })
  async getMode(@Req() req: Request, @Query('storeId') storeId?: string) {
    const resolvedStoreId = await this.resolveStoreId(req, storeId);
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: resolvedStoreId },
      select: { fulfillmentMode: true },
    });
    return store;
  }

  @Put('mode')
  @ApiOperation({ summary: 'Set the fulfillment mode — switching to MANUAL stops all auto-push to Printify/Merchize for this store' })
  async setMode(@Req() req: Request, @Body() dto: SetFulfillmentModeDto) {
    const resolvedStoreId = await this.resolveStoreId(req, dto.storeId);
    await this.prisma.store.update({
      where: { id: resolvedStoreId },
      data:  { fulfillmentMode: dto.mode },
    });
    return { success: true, mode: dto.mode };
  }

  @Get('connections')
  @ApiOperation({ summary: "List a store's fulfillment provider connections — platform-wide across every store when a SUPER_ADMIN requests it with no storeId" })
  async listConnections(@Req() req: Request, @Query('storeId') storeId?: string) {
    const context = await this.storeContext.resolve(req);
    if (context.isPlatformContext && !storeId) {
      return this.connections.listAllPlatform();
    }
    const resolvedStoreId = this.storeContext.resolveTargetStoreId(context, storeId);
    return this.connections.listForStore(resolvedStoreId);
  }

  @Post('connections')
  @ApiOperation({ summary: 'Connect a fulfillment provider account (e.g. Printify) to a store' })
  async connect(@Req() req: Request, @Body() dto: ConnectProviderDto) {
    const resolvedStoreId = await this.resolveStoreId(req, dto.storeId);
    return this.connections.connect(resolvedStoreId, dto.provider, dto.apiKey, dto.externalShopId);
  }

  @Delete('connections/:id')
  @ApiOperation({ summary: 'Disconnect a fulfillment provider connection' })
  async disconnect(@Req() req: Request, @Param('id') id: string, @Query('storeId') storeId?: string) {
    const resolvedStoreId = await this.resolveStoreId(req, storeId);
    await this.connections.disconnect(resolvedStoreId, id);
    return { success: true };
  }

  @Put('connections/:id/webhook-secret')
  @ApiOperation({ summary: "Save the webhook verification secret generated in the provider's own dashboard (e.g. Merchize)" })
  async setWebhookSecret(@Req() req: Request, @Param('id') id: string, @Body() dto: SetWebhookSecretDto) {
    const resolvedStoreId = await this.resolveStoreId(req, dto.storeId);
    await this.connections.setWebhookSecret(resolvedStoreId, id, dto.secret);
    return { success: true };
  }

  @Get('connections/:id/shop-products')
  @ApiOperation({ summary: "Browse the seller's existing products in their connected provider shop, for mapping" })
  async shopProducts(@Req() req: Request, @Param('id') id: string, @Query('storeId') storeId?: string) {
    const resolvedStoreId = await this.resolveStoreId(req, storeId);
    return this.connections.listShopProducts(resolvedStoreId, id);
  }

  @Get('mappings')
  @ApiOperation({ summary: "List product/variant → provider mappings for a store" })
  async listMappings(@Req() req: Request, @Query('storeId') storeId?: string) {
    const resolvedStoreId = await this.resolveStoreId(req, storeId);
    return this.prisma.productFulfillmentMapping.findMany({
      where: { connection: { storeId: resolvedStoreId } },
    });
  }

  @Put('mappings')
  @ApiOperation({ summary: 'Map an internal product/variant to a provider shop product/variant' })
  async saveMapping(@Req() req: Request, @Body() dto: SaveMappingDto) {
    const resolvedStoreId = await this.resolveStoreId(req, dto.storeId);

    const [connection, product] = await Promise.all([
      this.prisma.storeFulfillmentConnection.findFirst({ where: { id: dto.connectionId, storeId: resolvedStoreId } }),
      this.prisma.product.findFirst({ where: { id: dto.productId, storeId: resolvedStoreId } }),
    ]);
    if (!connection) throw new BadRequestException('Connection not found for this store');
    if (!product) throw new BadRequestException('Product not found for this store');

    // Not upsert()'d on the compound (productId, variantId) unique — Prisma's
    // generated WhereUniqueInput for a compound key with a nullable member
    // doesn't reliably accept `null` there. findFirst + branch instead.
    const variantId = dto.variantId ?? null;
    const existing = await this.prisma.productFulfillmentMapping.findFirst({
      where: { productId: dto.productId, variantId },
    });

    if (existing) {
      return this.prisma.productFulfillmentMapping.update({
        where: { id: existing.id },
        data: {
          connectionId:      dto.connectionId,
          externalProductId: dto.externalProductId,
          externalVariantId: dto.externalVariantId,
        },
      });
    }

    return this.prisma.productFulfillmentMapping.create({
      data: {
        connectionId:      dto.connectionId,
        productId:         dto.productId,
        variantId,
        externalProductId: dto.externalProductId,
        externalVariantId: dto.externalVariantId,
      },
    });
  }

  @Delete('mappings/:id')
  @ApiOperation({ summary: 'Remove a product/variant → provider mapping' })
  async deleteMapping(@Req() req: Request, @Param('id') id: string, @Query('storeId') storeId?: string) {
    const resolvedStoreId = await this.resolveStoreId(req, storeId);
    const mapping = await this.prisma.productFulfillmentMapping.findFirst({
      where: { id, connection: { storeId: resolvedStoreId } },
    });
    if (!mapping) throw new BadRequestException('Mapping not found for this store');
    await this.prisma.productFulfillmentMapping.delete({ where: { id } });
    return { success: true };
  }
}
