import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreOwnerGuard } from '../stores/guards/store-owner.guard';
import { SubscriptionsService } from './subscriptions.service';
import { toSellerView } from './subscription-status.util';

// Seller-only view of their OWN store's Plus subscription — fully separate
// from GET /admin/stores/:id/subscription (SUPER_ADMIN, raw record,
// AdminSubscriptionsController). StoreOwnerGuard (not StoreContextService)
// on purpose, same reasoning as FinancesController: a platform-context
// SUPER_ADMIN has no legitimate reason to view another seller's subscription
// through this route. Response is built via toSellerView(), which omits
// grantedByUserId/paymentProvider/externalSubscriptionId by construction.
@ApiTags('Seller - Subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreOwnerGuard)
@Controller('seller/subscription')
export class SellerSubscriptionController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  async getMine(@Req() req: any) {
    const sub = await this.subscriptions.getForStore(req.store.id);
    return toSellerView(sub);
  }
}
