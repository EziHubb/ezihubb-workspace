import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { DesignLicensingService } from './design-licensing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
export class DesignLicensingController {
  constructor(private readonly svc: DesignLicensingService) {}

  @Get('marketplace/designs')
  listDesigns(@Query() query: { page?: string; limit?: string; licenseType?: string; search?: string }) {
    return this.svc.listDesigns({
      page:        query.page  ? parseInt(query.page)  : undefined,
      limit:       query.limit ? parseInt(query.limit) : undefined,
      licenseType: query.licenseType,
      search:      query.search,
    });
  }

  @Get('marketplace/designs/:id')
  getDesign(@Param('id') id: string) {
    return this.svc.getDesign(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('marketplace/designs/:id/license')
  purchaseLicense(@Param('id') id: string, @Request() req: any) {
    return this.svc.purchaseLicense(req.user.storeId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/designs')
  listDesignForLicense(@Body() dto: any, @Request() req: any) {
    return this.svc.listDesignForLicense(req.user.storeId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('seller/licenses')
  getMyLicenses(@Query('role') role: 'licensor' | 'licensee' = 'licensee', @Request() req: any) {
    return this.svc.getMyLicenses(req.user.storeId, role);
  }
}
