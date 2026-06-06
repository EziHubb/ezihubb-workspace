import {
  Body, Controller, HttpCode, HttpStatus, Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

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
}
