import { Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { SettingsService } from './settings.service';

@AdminController('cache')
export class AdminCacheController {
  constructor(private readonly settings: SettingsService) {}

  @Post('flush')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Flush all Redis settings cache keys' })
  async flush() {
    await this.settings.flushSettingsCache();
  }
}
