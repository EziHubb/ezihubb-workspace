import {
  Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus, Request,
  NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminController } from '../../common/decorators/admin-controller.decorator';

class CreateShopSectionDto {
  @ApiProperty()
  @IsString() @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt() @Min(0) @Type(() => Number)
  sortOrder?: number;
}

class UpdateShopSectionDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Type(() => Number)
  sortOrder?: number;
}

/** Returns the storeId the caller owns, or null if they are a super-admin. */
async function resolveStoreId(
  prisma: PrismaService,
  user: { sub?: string; id?: string; role?: string },
): Promise<string | null> {
  if (user.role === 'SUPER_ADMIN') return null;

  const userId = user.sub ?? user.id;
  const dbUser = await prisma.user.findUnique({
    where:  { id: userId },
    select: { storeId: true },
  });
  if (!dbUser?.storeId) {
    throw new ForbiddenException('No store associated with your account');
  }
  return dbUser.storeId;
}

@AdminController('shop-sections')
export class AdminShopSectionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List shop sections (scoped to own store for shop owners)' })
  async findAll(@Request() req: any) {
    const storeId = await resolveStoreId(this.prisma, req.user);
    return this.prisma.shopSection.findMany({
      where:   storeId ? { storeId } : undefined,
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shop section' })
  async create(@Request() req: any, @Body() dto: CreateShopSectionDto) {
    const storeId = await resolveStoreId(this.prisma, req.user);
    return this.prisma.shopSection.create({
      data: { ...dto, ...(storeId ? { storeId } : {}) },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a shop section' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateShopSectionDto) {
    const storeId = await resolveStoreId(this.prisma, req.user);
    await this.assertOwnership(id, storeId);
    return this.prisma.shopSection.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a shop section (detaches its products)' })
  async delete(@Request() req: any, @Param('id') id: string) {
    const storeId = await resolveStoreId(this.prisma, req.user);
    await this.assertOwnership(id, storeId);
    await this.prisma.product.updateMany({
      where: { shopSectionId: id },
      data:  { shopSectionId: null },
    });
    await this.prisma.shopSection.delete({ where: { id } });
  }

  private async assertOwnership(id: string, storeId: string | null) {
    if (!storeId) return; // super-admin: no ownership check
    const section = await this.prisma.shopSection.findUnique({
      where:  { id },
      select: { storeId: true },
    });
    if (!section) throw new NotFoundException('Section not found');
    if (section.storeId !== storeId) throw new ForbiddenException('Section does not belong to your store');
  }
}
