import {
  Get,
  Patch,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { SettingsService } from './settings.service';

@AdminController('settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  // ── Store ────────────────────────────────────────────────────────────────────

  @Get('store')
  @ApiOperation({ summary: 'Get store settings' })
  getStore() {
    return this.settings.getSettings('store');
  }

  @Patch('store')
  @ApiOperation({ summary: 'Update store settings (partial merge)' })
  updateStore(@Body() body: Record<string, unknown>) {
    return this.settings.updateSettings('store', body);
  }

  // ── Email ─────────────────────────────────────────────────────────────────

  @Get('email')
  @ApiOperation({ summary: 'Get SMTP / email settings' })
  getEmail() {
    return this.settings.getSettings('email');
  }

  @Patch('email')
  @ApiOperation({ summary: 'Update SMTP / email settings' })
  updateEmail(@Body() body: Record<string, unknown>) {
    return this.settings.updateSettings('email', body);
  }

  @Post('email/test')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send a test email to the current admin' })
  async testEmail(@CurrentUser() admin: JwtPayload) {
    await this.settings.sendTestEmail(admin.email);
  }

  // ── Notifications ────────────────────────────────────────────────────────────

  @Get('notifications')
  @ApiOperation({ summary: 'Get notification preferences' })
  getNotifications() {
    return this.settings.getSettings('notifications');
  }

  @Patch('notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  updateNotifications(@Body() body: Record<string, unknown>) {
    return this.settings.updateSettings('notifications', body);
  }

  // ── SEO ───────────────────────────────────────────────────────────────────

  @Get('seo')
  @ApiOperation({ summary: 'Get SEO & analytics settings' })
  getSeo() {
    return this.settings.getSettings('seo');
  }

  @Patch('seo')
  @ApiOperation({ summary: 'Update SEO & analytics settings' })
  updateSeo(@Body() body: Record<string, unknown>) {
    return this.settings.updateSettings('seo', body);
  }
}
