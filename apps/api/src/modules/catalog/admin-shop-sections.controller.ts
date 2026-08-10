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
import { StoreContextService } from '../../common/services/store-context.service';

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

@AdminController('shop-sections')
export class AdminShopSectionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeContext: StoreContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List shop sections (scoped to own store for shop owners)' })
  async findAll(@Request() req: any) {
    const context = await this.storeContext.resolve(req);
    return this.prisma.shopSection.findMany({
      where:   context.storeId ? { storeId: context.storeId } : undefined,
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shop section' })
  async create(@Request() req: any, @Body() dto: CreateShopSectionDto) {
    const context = await this.storeContext.resolve(req);
    return this.prisma.shopSection.create({
      data: { ...dto, ...(context.storeId ? { storeId: context.storeId } : {}) },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a shop section' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateShopSectionDto) {
    const context = await this.storeContext.resolve(req);
    await this.assertOwnership(id, context.storeId);
    return this.prisma.shopSection.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a shop section (detaches its products)' })
  async delete(@Request() req: any, @Param('id') id: string) {
    const context = await this.storeContext.resolve(req);
    await this.assertOwnership(id, context.storeId);
    await this.prisma.product.updateMany({
      where: { shopSectionId: id },
      data:  { shopSectionId: null },
    });
    await this.prisma.shopSection.delete({ where: { id } });
  }

  private async assertOwnership(id: string, storeId: string | null) {
    if (!storeId) return; // platform context: no ownership check
    const section = await this.prisma.shopSection.findUnique({
      where:  { id },
      select: { storeId: true },
    });
    if (!section) throw new NotFoundException('Section not found');
    if (section.storeId !== storeId) throw new ForbiddenException('Section does not belong to your store');
  }
}
