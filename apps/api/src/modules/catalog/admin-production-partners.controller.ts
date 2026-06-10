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
  @ApiOperation({ summary: 'Update production partner' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductionPartnerDto) {
    return this.prisma.productionPartner.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete production partner' })
  async delete(@Param('id') id: string) {
    await this.prisma.productionPartner.delete({ where: { id } });
  }
}
