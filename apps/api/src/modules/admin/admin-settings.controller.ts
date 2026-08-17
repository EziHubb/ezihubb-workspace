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
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { SettingsService } from './settings.service';

// Every setting here is a single platform-wide row (AppSettings, keyed by
// 'store'/'email'/'notifications'/'seo'/'theme') — there is no per-store
// variant. @AdminController('settings') allows ADMIN class-wide for other
// admin controllers' sake, so every method below overrides to SUPER_ADMIN
// only — RolesGuard checks method-level @Roles() before class-level
// (Reflector.getAllAndOverride), so this narrows correctly per-endpoint.
// Matches the frontend's own route guard, which blocks a shop-owner from
// even loading the /settings page (apps/admin/.../layout.tsx).
@AdminController('settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  // ── Store ────────────────────────────────────────────────────────────────────

  @Get('store')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get store settings' })
  getStore() {
    return this.settings.getSettings('store');
  }

  @Patch('store')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update store settings (partial merge)' })
  updateStore(@Body() body: Record<string, unknown>) {
    return this.settings.updateSettings('store', body);
  }

  // ── Email ─────────────────────────────────────────────────────────────────

  @Get('email')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get SMTP / email settings' })
  getEmail() {
    return this.settings.getSettings('email');
  }

  @Patch('email')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update SMTP / email settings' })
  updateEmail(@Body() body: Record<string, unknown>) {
    return this.settings.updateSettings('email', body);
  }

  @Post('email/test')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send a test email to the current admin' })
  async testEmail(@CurrentUser() admin: JwtPayload) {
    await this.settings.sendTestEmail(admin.email);
  }

  // ── Notifications ────────────────────────────────────────────────────────────

  @Get('notifications')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get notification preferences' })
  getNotifications() {
    return this.settings.getSettings('notifications');
  }

  @Patch('notifications')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update notification preferences' })
  updateNotifications(@Body() body: Record<string, unknown>) {
    return this.settings.updateSettings('notifications', body);
  }

  // ── SEO ───────────────────────────────────────────────────────────────────

  @Get('seo')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get SEO & analytics settings' })
  getSeo() {
    return this.settings.getSettings('seo');
  }

  @Patch('seo')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update SEO & analytics settings' })
  updateSeo(@Body() body: Record<string, unknown>) {
    return this.settings.updateSettings('seo', body);
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  @Get('theme')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get site theme settings' })
  getTheme() {
    return this.settings.getSettings('theme');
  }

  @Patch('theme')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update site theme settings' })
  updateTheme(@Body() body: Record<string, unknown>) {
    return this.settings.updateSettings('theme', body);
  }
}
