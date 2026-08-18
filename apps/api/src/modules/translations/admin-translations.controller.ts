import { Body, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TranslationService,
  TRANSLATABLE_FIELDS,
  type TranslatableEntityType,
} from './translation.service';
import { AutoTranslateService } from './auto-translate.service';

class UpdateTranslationDto {
  locale!: string;
  translations!: Record<string, string>;
}

@Roles(Role.SUPER_ADMIN)
@AdminController('translations')
export class AdminTranslationsController {
  constructor(
    private readonly prisma:               PrismaService,
    private readonly translationService:   TranslationService,
    private readonly autoTranslateService: AutoTranslateService,
  ) {}

  /** GET /admin/translations/:entityType/:entityId — all locale translations for the admin editor */
  @Get(':entityType/:entityId')
  @ApiOperation({ summary: 'Get all locale translations for an entity (admin editor)' })
  async getAll(
    @Param('entityType') entityType: string,
    @Param('entityId')   entityId:   string,
  ) {
    return this.translationService.getAllLocaleTranslations(
      entityType as TranslatableEntityType,
      entityId,
    );
  }

  /** PATCH /admin/translations/:entityType/:entityId — save translations for one locale */
  @Patch(':entityType/:entityId')
  @ApiOperation({ summary: 'Save translations for one locale (manually overrides auto-translation)' })
  async update(
    @Param('entityType') entityType: string,
    @Param('entityId')   entityId:   string,
    @Body()              dto:        UpdateTranslationDto,
  ) {
    await this.translationService.setTranslations(
      entityType as TranslatableEntityType,
      entityId,
      dto.locale,
      dto.translations,
      false, // isAutoTranslated = false (manual)
    );
    return { updated: true };
  }

  /** POST /admin/translations/:entityType/:entityId/retranslate — queue auto-translation */
  @Post(':entityType/:entityId/retranslate')
  @ApiOperation({ summary: 'Queue auto-translation job for this entity (force re-translate)' })
  async retranslate(
    @Param('entityType') entityType: string,
    @Param('entityId')   entityId:   string,
  ) {
    const sourceData = await this.loadEntitySourceData(
      entityType as TranslatableEntityType,
      entityId,
    );

    this.autoTranslateService.triggerTranslation(
      entityType as TranslatableEntityType,
      entityId,
      sourceData,
      true,
    );

    return { queued: true };
  }

  private async loadEntitySourceData(
    entityType: TranslatableEntityType,
    entityId:   string,
  ): Promise<Record<string, string>> {
    const fields = TRANSLATABLE_FIELDS[entityType] ?? [];
    const select: Record<string, true> = {};
    for (const f of fields) select[f] = true;

    let row: Record<string, unknown> | null = null;

    if (entityType === 'Product') {
      row = await this.prisma.product.findUnique({ where: { id: entityId }, select }) as Record<string, unknown> | null;
    } else if (entityType === 'Category') {
      row = await this.prisma.category.findUnique({ where: { id: entityId }, select }) as Record<string, unknown> | null;
    }

    if (!row) return {};
    const result: Record<string, string> = {};
    for (const f of fields) {
      const v = row[f];
      if (typeof v === 'string' && v.trim()) result[f] = v;
    }
    return result;
  }
}
