import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreCreditsService } from './store-credits.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class StoreCreditsController {
  constructor(private readonly svc: StoreCreditsService) {}

  @Get('store-credits/me')
  getMyCredits(@Request() req: any) {
    return this.svc.getUserStoreCredits(req.user.id);
  }

  @Get('orders/:orderNumber/buyer-referral')
  getBuyerReferral(@Param('orderNumber') orderNumber: string, @Request() req: any) {
    return this.svc.getBuyerReferralForOrder(orderNumber, req.user.id);
  }
}
