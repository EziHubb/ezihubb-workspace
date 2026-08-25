import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationReportReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportConversationDto {
  /**
   * Constrained to the enum rather than free text, so the review queue can be
   * filtered and counted. The free-text half is `note`, which is where the
   * detail that actually helps a reviewer lives.
   */
  @ApiProperty({ enum: ConversationReportReason })
  @IsEnum(ConversationReportReason)
  reason: ConversationReportReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
