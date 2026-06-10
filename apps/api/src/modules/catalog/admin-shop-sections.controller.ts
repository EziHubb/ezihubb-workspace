import {
  Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus,
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

@AdminController('shop-sections')
export class AdminShopSectionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all shop sections' })
  async findAll() {
    return this.prisma.shopSection.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shop section' })
  async create(@Body() dto: CreateShopSectionDto) {
    return this.prisma.shopSection.create({ data: dto });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a shop section' })
  async update(@Param('id') id: string, @Body() dto: UpdateShopSectionDto) {
    return this.prisma.shopSection.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a shop section (detaches its products)' })
  async delete(@Param('id') id: string) {
    // Detach products before deleting
    await this.prisma.product.updateMany({
      where:  { shopSectionId: id },
      data:   { shopSectionId: null },
    });
    await this.prisma.shopSection.delete({ where: { id } });
  }
}
