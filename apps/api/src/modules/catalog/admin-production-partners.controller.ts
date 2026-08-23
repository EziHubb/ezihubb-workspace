import {
  Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  IsString, IsOptional, MaxLength,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';

class CreateProductionPartnerDto {
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
}

class UpdateProductionPartnerDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
}

@AdminController('production-partners')
export class AdminProductionPartnersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List production partners' })
  async findAll() {
    return this.prisma.productionPartner.findMany({
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create production partner' })
  async create(@Body() dto: CreateProductionPartnerDto) {
    return this.prisma.productionPartner.create({ data: dto });
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update production partner' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductionPartnerDto) {
    return this.prisma.productionPartner.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete production partner' })
  /**
   * Deleting a partner also removes its id from every listing that named it.
   *
   * Product.productionPartnerIds is a plain String[] with no foreign key, so
   * nothing does this automatically: the id would simply stay behind. That was
   * invisible while the field was never read, but the storefront now discloses
   * these names on the product page, and a dangling id is a listing claiming a
   * partner that no longer exists.
   *
   * One transaction, so a listing can never be left pointing at a partner the
   * delete has already removed.
   */
  async delete(@Param('id') id: string) {
    await this.prisma.$transaction(async (tx) => {
      const affected = await tx.product.findMany({
        where:  { productionPartnerIds: { has: id } },
        select: { id: true, productionPartnerIds: true },
      });

      for (const p of affected) {
        await tx.product.update({
          where: { id: p.id },
          data:  { productionPartnerIds: p.productionPartnerIds.filter((pid) => pid !== id) },
        });
      }

      await tx.productionPartner.delete({ where: { id } });
    });
  }
}
