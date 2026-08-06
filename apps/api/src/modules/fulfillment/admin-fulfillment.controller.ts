import { Body, Delete, Get, Param, Post, Put, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { FulfillmentProviderType } from '@prisma/client';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { FulfillmentConnectionsService } from './fulfillment-connections.service';

interface JwtLike { sub?: string; id?: string; role?: string; storeId?: string }

/** Returns the storeId the caller owns, or null for SUPER_ADMIN (no store selected). */
async function resolveSellerStoreId(prisma: PrismaService, user: JwtLike): Promise<string | null> {
  if (user.role === 'SUPER_ADMIN') return null;
  if (user.storeId) return user.storeId;
  const userId = user.sub ?? user.id;
  if (!userId) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { storeId: true } });
  return dbUser?.storeId ?? null;
}

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
}

@AdminController('fulfillment')
export class AdminFulfillmentController {
  constructor(
    private readonly connections: FulfillmentConnectionsService,
    private readonly prisma:      PrismaService,
  ) {}

  private async requireStoreId(req: Request): Promise<string> {
    const storeId = await resolveSellerStoreId(this.prisma, req.user as JwtLike);
    if (!storeId) {
      throw new BadRequestException('Fulfillment connections are managed per-store — select a store first');
    }
    return storeId;
  }

  @Get('connections')
  @ApiOperation({ summary: "List the current store's fulfillment provider connections" })
  async listConnections(@Req() req: Request) {
    const storeId = await this.requireStoreId(req);
    return this.connections.listForStore(storeId);
  }

  @Post('connections')
  @ApiOperation({ summary: 'Connect a fulfillment provider account (e.g. Printify) to the current store' })
  async connect(@Req() req: Request, @Body() dto: ConnectProviderDto) {
    const storeId = await this.requireStoreId(req);
    return this.connections.connect(storeId, dto.provider, dto.apiKey, dto.externalShopId);
  }

  @Delete('connections/:id')
  @ApiOperation({ summary: 'Disconnect a fulfillment provider connection' })
  async disconnect(@Req() req: Request, @Param('id') id: string) {
    const storeId = await this.requireStoreId(req);
    await this.connections.disconnect(storeId, id);
    return { success: true };
  }

  @Get('connections/:id/shop-products')
  @ApiOperation({ summary: "Browse the seller's existing products in their connected provider shop, for mapping" })
  async shopProducts(@Req() req: Request, @Param('id') id: string) {
    const storeId = await this.requireStoreId(req);
    return this.connections.listShopProducts(storeId, id);
  }

  @Get('mappings')
  @ApiOperation({ summary: 'List product/variant → provider mappings for the current store' })
  async listMappings(@Req() req: Request) {
    const storeId = await this.requireStoreId(req);
    return this.prisma.productFulfillmentMapping.findMany({
      where: { connection: { storeId } },
    });
  }

  @Put('mappings')
  @ApiOperation({ summary: 'Map an internal product/variant to a provider shop product/variant' })
  async saveMapping(@Req() req: Request, @Body() dto: SaveMappingDto) {
    const storeId = await this.requireStoreId(req);

    const [connection, product] = await Promise.all([
      this.prisma.storeFulfillmentConnection.findFirst({ where: { id: dto.connectionId, storeId } }),
      this.prisma.product.findFirst({ where: { id: dto.productId, storeId } }),
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
  async deleteMapping(@Req() req: Request, @Param('id') id: string) {
    const storeId = await this.requireStoreId(req);
    const mapping = await this.prisma.productFulfillmentMapping.findFirst({
      where: { id, connection: { storeId } },
    });
    if (!mapping) throw new BadRequestException('Mapping not found for this store');
    await this.prisma.productFulfillmentMapping.delete({ where: { id } });
    return { success: true };
  }
}
