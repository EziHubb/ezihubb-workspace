import {
  Body, Controller, HttpCode, HttpStatus, Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

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

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
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
    await this.prisma.notification.create({
      data: {
        userId:  null as any,
        type:    'PRODUCT_READY',
        title:   'Product availability request',
        body:    `${dto.email} wants to be notified when ${dto.productName ?? dto.productId} is available`,
        data:    { email: dto.email, productId: dto.productId },
      },
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
