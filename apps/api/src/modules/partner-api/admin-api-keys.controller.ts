import { Body, Delete, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoreContextService } from '../../common/services/store-context.service';
import { ApiKeysService } from './api-keys.service';

class CreateApiKeyDto {
  @ApiProperty({ example: 'Zapier integration' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

@AdminController('api-keys')
export class AdminApiKeysController {
  constructor(
    private readonly apiKeys:      ApiKeysService,
    private readonly storeContext: StoreContextService,
  ) {}

  private async requireStoreId(req: Request): Promise<string> {
    const context = await this.storeContext.resolve(req);
    return this.storeContext.requireStoreId(context);
  }

  @Get()
  @ApiOperation({ summary: "List the current store's partner API keys" })
  async list(@Req() req: Request) {
    const storeId = await this.requireStoreId(req);
    return this.apiKeys.listForStore(storeId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new partner API key for the current store (shown once)' })
  async create(@Req() req: Request, @Body() dto: CreateApiKeyDto) {
    const storeId = await this.requireStoreId(req);
    return this.apiKeys.create(storeId, dto.name);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a partner API key' })
  async revoke(@Req() req: Request, @Param('id') id: string) {
    const storeId = await this.requireStoreId(req);
    await this.apiKeys.revoke(storeId, id);
    return { success: true };
  }
}
