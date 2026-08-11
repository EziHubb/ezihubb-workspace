import { Body, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoreContextService } from '../../common/services/store-context.service';
import { ApiKeysService } from './api-keys.service';

const STORE_ID_DESC = 'Required only when managing platform-wide (SUPER_ADMIN, no store switched into) — which store to act on. Ignored for a scoped caller, who always acts on their own store.';

class CreateApiKeyDto {
  @ApiProperty({ example: 'Zapier integration' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: STORE_ID_DESC })
  @IsOptional()
  @IsString()
  storeId?: string;
}

@AdminController('api-keys')
export class AdminApiKeysController {
  constructor(
    private readonly apiKeys:      ApiKeysService,
    private readonly storeContext: StoreContextService,
  ) {}

  /** Resolves which store to act on — ambient for a scoped caller, explicit `storeId` required for a platform-context SUPER_ADMIN. */
  private async resolveStoreId(req: Request, storeId?: string): Promise<string> {
    const context = await this.storeContext.resolve(req);
    return this.storeContext.resolveTargetStoreId(context, storeId);
  }

  @Get()
  @ApiOperation({ summary: "List a store's partner API keys — platform-wide across every store when a SUPER_ADMIN requests it with no storeId" })
  async list(@Req() req: Request, @Query('storeId') storeId?: string) {
    const context = await this.storeContext.resolve(req);
    if (context.isPlatformContext && !storeId) {
      return this.apiKeys.listAllPlatform();
    }
    const resolvedStoreId = this.storeContext.resolveTargetStoreId(context, storeId);
    return this.apiKeys.listForStore(resolvedStoreId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new partner API key for a store (shown once)' })
  async create(@Req() req: Request, @Body() dto: CreateApiKeyDto) {
    const resolvedStoreId = await this.resolveStoreId(req, dto.storeId);
    return this.apiKeys.create(resolvedStoreId, dto.name);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a partner API key' })
  async revoke(@Req() req: Request, @Param('id') id: string, @Query('storeId') storeId?: string) {
    const resolvedStoreId = await this.resolveStoreId(req, storeId);
    await this.apiKeys.revoke(resolvedStoreId, id);
    return { success: true };
  }
}
