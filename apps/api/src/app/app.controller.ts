import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { SettingsService } from '../modules/admin/settings.service';

@Controller()
@ApiTags('Config')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('settings/theme')
  @SkipThrottle()
  getSiteTheme() {
    return this.settings.getSettings('theme');
  }
}
