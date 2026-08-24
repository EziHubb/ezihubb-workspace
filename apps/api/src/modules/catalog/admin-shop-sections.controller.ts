import {
  Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus, Request,
  NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, Min, MaxLength, IsArray, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoreContextService } from '../../common/services/store-context.service';

/**
 * Limits taken from the seller UI, and enforced HERE as well as there.
 * A cap the browser alone keeps is not a cap: the same endpoints are open to
 * anything holding a seller token.
 */
export const MAX_SECTIONS_PER_STORE = 20;
export const MAX_SECTION_NAME       = 24;

class CreateShopSectionDto {
  @ApiProperty()
  @IsString() @MaxLength(MAX_SECTION_NAME)
  name: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt() @Min(0) @Type(() => Number)
  sortOrder?: number;
}

class UpdateShopSectionDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(MAX_SECTION_NAME)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0) @Type(() => Number)
  sortOrder?: number;
}

class ReorderShopSectionsDto {
  /** Section ids in their new display order — index becomes sortOrder. */
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(MAX_SECTIONS_PER_STORE)
  @IsString({ each: true })
  ids: string[];
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

    // Counted per store, and only for a store: a platform-context SUPER_ADMIN
    // is not creating "their" sections, so a global cap would be meaningless.
    if (context.storeId) {
      const existing = await this.prisma.shopSection.count({ where: { storeId: context.storeId } });
      if (existing >= MAX_SECTIONS_PER_STORE) {
        throw new BadRequestException({
          code:    'ERR_SECTION_LIMIT',
          message: `A shop can have at most ${MAX_SECTIONS_PER_STORE} sections.`,
        });
      }
    }

    return this.prisma.shopSection.create({
      data: { ...dto, ...(context.storeId ? { storeId: context.storeId } : {}) },
    });
  }

  /**
   * Rewrites the whole order in one transaction.
   *
   * Declared BEFORE `@Patch(':id')`: Nest matches in declaration order, so the
   * parameterised route would otherwise swallow "reorder" and try to update a
   * section with that id.
   *
   * One request rather than one PATCH per row, because a drag that half
   * succeeds leaves the shop showing an order the seller never chose — and
   * they would have no way to tell which half landed.
   */
  @Patch('reorder')
  @ApiOperation({ summary: 'Set the display order of every section at once' })
  async reorder(@Request() req: any, @Body() dto: ReorderShopSectionsDto) {
    const context = await this.storeContext.resolve(req);

    // Every id must belong to the caller's store before anything is written.
    // Checking inside the loop would let a foreign id abort the transaction
    // halfway on some databases and land it on others.
    const owned = await this.prisma.shopSection.findMany({
      where:  { id: { in: dto.ids }, ...(context.storeId ? { storeId: context.storeId } : {}) },
      select: { id: true },
    });
    if (owned.length !== dto.ids.length) {
      throw new ForbiddenException('One or more sections do not belong to your store');
    }

    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.shopSection.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return { reordered: dto.ids.length };
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
