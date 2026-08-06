import { Body, Delete, Get, Param, Post, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeysService } from './api-keys.service';

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
    private readonly apiKeys: ApiKeysService,
    private readonly prisma:  PrismaService,
  ) {}

  private async requireStoreId(req: Request): Promise<string> {
    const storeId = await resolveSellerStoreId(this.prisma, req.user as JwtLike);
    if (!storeId) {
      throw new BadRequestException('API keys are issued per-store — select a store first');
    }
    return storeId;
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
