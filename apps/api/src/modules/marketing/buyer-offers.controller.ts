import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BuyerOffersService } from './buyer-offers.service';
import { CreateOfferDto, CounterOfferDto, UpdateOffersSettingsDto } from './dto/buyer-offer.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Role } from '@ezihubb/constants';
import { StoreContextService } from '../../common/services/store-context.service';

@ApiTags('buyer-offers')
@Controller('offers')
export class BuyerOffersController {
  constructor(
    private readonly buyerOffersService: BuyerOffersService,
    private readonly storeContext: StoreContextService,
  ) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  @Public()
  @Get('eligibility/:productId')
  @ApiOperation({ summary: 'Whether a product currently accepts buyer offers (for the storefront "Make an offer" button)' })
  async checkEligibility(@Param('productId') productId: string): Promise<{ eligible: boolean }> {
    return { eligible: await this.buyerOffersService.isEligible(productId) };
  }

  // ── Buyer ────────────────────────────────────────────────────────────────────

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Make an offer on a listing' })
  async createOffer(@Req() req: Request, @Body() dto: CreateOfferDto, @CurrentUser() user: JwtPayload) {
    return this.buyerOffersService.createOffer(user.sub, dto.productId, dto.offeredPrice);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List the current buyer's offers" })
  async listMyOffers(@CurrentUser() user: JwtPayload) {
    return this.buyerOffersService.listMyOffers(user.sub);
  }

  @Post(':id/accept-counter')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Accept the seller's counter-offer" })
  async acceptCounter(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.buyerOffersService.respondToCounter(user.sub, id, true);
  }

  @Post(':id/reject-counter')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Reject the seller's counter-offer" })
  async rejectCounter(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.buyerOffersService.respondToCounter(user.sub, id, false);
  }

  // ── Seller (admin) ──────────────────────────────────────────────────────────

  @Get('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Get the store's 'Let buyers make offers' settings" })
  async getSettings(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.buyerOffersService.getSettings(storeId);
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Update the store's 'Let buyers make offers' settings" })
  async updateSettings(@Req() req: Request, @Body() dto: UpdateOffersSettingsDto) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.buyerOffersService.updateSettings(storeId, dto);
  }

  @Get('inbox')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List offers received for the current store' })
  async listInbox(@Req() req: Request, @Query('status') status?: string) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.buyerOffersService.listInbox(storeId, status);
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Accept a buyer offer' })
  async accept(@Req() req: Request, @Param('id') id: string) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.buyerOffersService.sellerAccept(storeId, id);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject a buyer offer' })
  async reject(@Req() req: Request, @Param('id') id: string) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.buyerOffersService.sellerReject(storeId, id);
  }

  @Post(':id/counter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Counter a buyer offer with a different price' })
  async counter(@Req() req: Request, @Param('id') id: string, @Body() dto: CounterOfferDto) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.buyerOffersService.sellerCounter(storeId, id, dto.counterPrice);
  }
}
