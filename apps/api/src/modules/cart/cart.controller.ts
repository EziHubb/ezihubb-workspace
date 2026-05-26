import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { EstimateShippingDto } from './dto/estimate-shipping.dto';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Cart')
@UseGuards(OptionalAuthGuard)
@Controller('cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current cart' })
  async getCart(
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { cart, newSessionId } = await this.cartService.getOrCreateCart(
      user?.sub,
      req.cookies?.['cart_session'] as string | undefined,
    );
    if (newSessionId) this.setSessionCookie(res, newSessionId);
    return cart;
  }

  @Post('items')
  @ApiOperation({ summary: 'Add item to cart' })
  async addItem(
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddCartItemDto,
  ) {
    const { cart, newSessionId } = await this.cartService.getOrCreateCart(
      user?.sub,
      req.cookies?.['cart_session'] as string | undefined,
    );
    if (newSessionId) this.setSessionCookie(res, newSessionId);
    return this.cartService.addItem(cart.id, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  async updateItem(
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const { cart } = await this.cartService.getOrCreateCart(
      user?.sub,
      req.cookies?.['cart_session'] as string | undefined,
    );
    return this.cartService.updateItem(cart.id, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  async removeItem(
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
    @Param('itemId') itemId: string,
  ) {
    const { cart } = await this.cartService.getOrCreateCart(
      user?.sub,
      req.cookies?.['cart_session'] as string | undefined,
    );
    return this.cartService.removeItem(cart.id, itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear cart' })
  async clearCart(
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
  ) {
    const { cart } = await this.cartService.getOrCreateCart(
      user?.sub,
      req.cookies?.['cart_session'] as string | undefined,
    );
    await this.cartService.clearCart(cart.id);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Merge guest cart into authenticated user cart' })
  async mergeGuestCart(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const guestSessionId = req.cookies?.['cart_session'] as string | undefined;
    if (!guestSessionId) {
      const { cart } = await this.cartService.getOrCreateCart(user.sub);
      return cart;
    }
    return this.cartService.mergeGuestCart(guestSessionId, user.sub);
  }

  @Post('apply-coupon')
  @ApiOperation({ summary: 'Apply coupon to cart' })
  async applyCoupon(
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
    @Body() dto: ApplyCouponDto,
  ) {
    const { cart } = await this.cartService.getOrCreateCart(
      user?.sub,
      req.cookies?.['cart_session'] as string | undefined,
    );
    return this.cartService.applyCoupon(cart.id, dto, user?.sub);
  }

  @Delete('coupon')
  @ApiOperation({ summary: 'Remove coupon from cart' })
  async removeCoupon(
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
  ) {
    const { cart } = await this.cartService.getOrCreateCart(
      user?.sub,
      req.cookies?.['cart_session'] as string | undefined,
    );
    return this.cartService.removeCoupon(cart.id);
  }

  @Post('estimate-shipping')
  @ApiOperation({ summary: 'Estimate shipping costs for cart' })
  async estimateShipping(
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
    @Body() dto: EstimateShippingDto,
  ) {
    const { cart } = await this.cartService.getOrCreateCart(
      user?.sub,
      req.cookies?.['cart_session'] as string | undefined,
    );
    return this.cartService.estimateShipping(cart.id, dto);
  }

  private setSessionCookie(res: Response, sessionId: string): void {
    const isProd = this.config.get<string>('app.env') === 'production';
    res.cookie('cart_session', sessionId, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1_000,
    });
  }
}
