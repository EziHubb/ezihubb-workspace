import {
  Get,
  Patch,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { SettingsService } from './settings.service';

class UpdateTemplateDto {
  @IsString()
  @IsNotEmpty()
  body!: string;
}

@AdminController('email-templates')
export class AdminEmailTemplatesController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all email templates with last-modified dates' })
  list() {
    return this.settings.listEmailTemplates();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a single email template body (DB override or file fallback)' })
  async get(@Param('slug') slug: string) {
    const tpl = await this.settings.getEmailTemplate(slug);
    if (!tpl.body || tpl.body.includes('not found')) {
      throw new NotFoundException(`Template "${slug}" not found`);
    }
    return tpl;
  }

  @Patch(':slug')
  @ApiOperation({ summary: 'Save a custom override for an email template' })
  update(@Param('slug') slug: string, @Body() dto: UpdateTemplateDto) {
    return this.settings.updateEmailTemplate(slug, dto.body);
  }
}
