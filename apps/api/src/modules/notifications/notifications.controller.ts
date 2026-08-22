import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Throttle } from '@nestjs/throttler';
import {
  IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { NotificationsService } from './notifications.service';

const CONTACT_SUBJECTS = [
  'general',
  'order',
  'personalization',
  'returns',
  'custom',
  'other',
] as const;

class ContactMessageDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsEmail()                                email: string;
  @IsEnum(CONTACT_SUBJECTS)                 subject: typeof CONTACT_SUBJECTS[number];
  @IsString() @MinLength(10) @MaxLength(2000) message: string;
  @IsOptional() @IsString() @MaxLength(50)  orderNumber?: string;
}

class ProductReadyDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(200) productId: string;
  @IsOptional() @IsString() @MaxLength(200) productName?: string;
}

class NewsletterSubscribeDto {
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
}

/**
 * The signed-in buyer's own notification feed.
 *
 * Split from NotificationsController, which is entirely anonymous (contact
 * form, newsletter, availability requests). Keeping them in one class would
 * mean a file where some routes are public and some are not, and the next
 * person adding a route would have to notice which kind they were writing.
 * Here the guard is on the class, so a new route is authenticated by default.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationFeedController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the signed-in user's notifications, newest first" })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    // No userId parameter anywhere: the only identity this endpoint accepts
    // is the one in the token.
    const beforeDate = before ? new Date(before) : undefined;
    return this.notifications.listForUser(user.sub, {
      limit:  limit ? Number(limit) : undefined,
      before: beforeDate && !Number.isNaN(beforeDate.getTime()) ? beforeDate : undefined,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for the bell badge' })
  async unreadCount(@CurrentUser() user: JwtPayload): Promise<{ count: number }> {
    return { count: await this.notifications.unreadCount(user.sub) };
  }

  // Declared BEFORE :id/read, or "read-all" would be captured as an id.
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark every notification read' })
  async markAllRead(@CurrentUser() user: JwtPayload): Promise<{ updated: number }> {
    return this.notifications.markAllRead(user.sub);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one notification read' })
  async markRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    // Ownership is enforced inside the same UPDATE, so an id belonging to
    // someone else simply matches nothing. 204 either way — telling the
    // caller which ids exist would be an enumeration oracle.
    await this.notifications.markRead(user.sub, id);
  }
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // Unauthenticated, and it sends mail to the platform inbox. The global
  // throttle is 300/min, which would let one IP deliver 300 emails a minute —
  // matching the limit auth.controller already uses for the same reason.
  @Throttle({ default: { ttl: 900_000, limit: 3 } })   // 3 per 15 min
  @Post('contact')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a contact form message' })
  async contact(@Body() dto: ContactMessageDto) {
    await this.notificationsService.sendContactMessage({
      name:        dto.name,
      email:       dto.email,
      subject:     dto.subject,
      message:     dto.message,
      orderNumber: dto.orderNumber,
    });
    return { success: true };
  }

  // Takes an arbitrary email address from an anonymous caller, so without a
  // tight limit it is a way to sign a victim up repeatedly.
  @Throttle({ default: { ttl: 900_000, limit: 5 } })   // 5 per 15 min
  @Post('product-ready')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe to product availability notification' })
  async productReady(@Body() dto: ProductReadyDto) {
    // Mailed to the platform inbox rather than written to Notification.
    //
    // This used to insert a row with `userId: null as any`. Notification.userId
    // is a non-null foreign key, so the cast hid the problem from the compiler
    // and Postgres rejected every insert — this endpoint returned 500 for every
    // caller, verified against production. It went unnoticed because no client
    // code calls it yet.
    //
    // The right fix is not to make the column nullable. A row here has no user
    // by nature: it is an anonymous shopper asking to hear about a restock, so
    // it is inbound correspondence, not an entry in anybody's notification
    // feed. Widening the column to fit it would have made the feed table hold
    // two unrelated kinds of record, distinguishable only by a null.
    await this.notificationsService.sendContactMessage({
      name:    dto.email,
      email:   dto.email,
      subject: 'Product availability request',
      message: `${dto.email} wants to be notified when ${dto.productName ?? dto.productId} is back in stock (product ${dto.productId}).`,
    });
    return { success: true };
  }

  @Throttle({ default: { ttl: 900_000, limit: 3 } })   // 3 per 15 min
  @Post('newsletter')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe to newsletter' })
  async newsletter(@Body() dto: NewsletterSubscribeDto) {
    await this.notificationsService.subscribeNewsletter(dto.email, dto.firstName);
    return { success: true };
  }
}

@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Throttle({ default: { ttl: 900_000, limit: 3 } })   // 3 per 15 min
  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe to newsletter (canonical path)' })
  async subscribe(@Body() dto: NewsletterSubscribeDto) {
    await this.notificationsService.subscribeNewsletter(dto.email, dto.firstName);
    return { success: true };
  }
}
