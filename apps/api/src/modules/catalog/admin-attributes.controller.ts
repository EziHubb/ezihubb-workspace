import {
  Controller, Get, Post, Delete,
  Body, Param, HttpCode, HttpStatus,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@mlh/constants';

// ── Valid attribute types ─────────────────────────────────────────────────────

const VALID_TYPES = new Set([
  'color', 'material', 'occasion', 'holiday',
  'recipient', 'style', 'sustainability', 'hat-type',
]);

class AddAttributeValueDto {
  @ApiProperty({ example: 'Sage Green' })
  @IsString() @MaxLength(120)
  value: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags('Admin — Attributes')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/attributes')
export class AdminAttributesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /admin/attributes/:type
   * Returns sorted list of attribute value strings for the given type.
   * Falls back to [] if no seed data — client has hardcoded fallbacks.
   */
  @Get(':type')
  @ApiOperation({ summary: 'Get searchable attribute values by type' })
  async getValues(@Param('type') type: string): Promise<string[]> {
    if (!VALID_TYPES.has(type)) {
      throw new BadRequestException(`Unknown attribute type: ${type}`);
    }
    const rows = await this.prisma.attributeValue.findMany({
      where:   { type },
      select:  { value: true },
      orderBy: { value: 'asc' },
    });
    return rows.map((r) => r.value);
  }

  /**
   * POST /admin/attributes/:type
   * Add a custom attribute value (admin only — e.g. shop-specific material).
   */
  @Post(':type')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a custom attribute value for a given type' })
  async addValue(
    @Param('type') type: string,
    @Body() dto: AddAttributeValueDto,
  ) {
    if (!VALID_TYPES.has(type)) {
      throw new BadRequestException(`Unknown attribute type: ${type}`);
    }
    return this.prisma.attributeValue.upsert({
      where:  { type_value: { type, value: dto.value.trim() } },
      update: {},
      create: { type, value: dto.value.trim() },
    });
  }

  /**
   * DELETE /admin/attributes/:type/:value
   * Remove a custom attribute value (soft: only user-added, protected seed values ignored).
   */
  @Delete(':type/:value')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a custom attribute value' })
  async removeValue(
    @Param('type') type: string,
    @Param('value') value: string,
  ) {
    await this.prisma.attributeValue.deleteMany({
      where: { type, value: decodeURIComponent(value) },
    });
  }
}
