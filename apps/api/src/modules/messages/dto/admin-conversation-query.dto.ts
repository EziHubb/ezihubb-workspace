import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ConversationStatus } from '@prisma/client';

/**
 * The inbox folders.
 *
 * Every one is a query over existing columns rather than a stored field: a
 * thread is not "in" the Unread folder, it simply has unread messages. Storing
 * a folder would mean keeping it in step with the status, the star and the
 * unread count on every write, and they would drift.
 */
export const CONVERSATION_FOLDERS = [
  'inbox',
  'starred',
  'order_help',
  'prospective_buyers',
  'from_platform',
  'sent',
  'all',
  'unread',
  'spam',
  'trash',
] as const;

export type AdminConversationFolder = (typeof CONVERSATION_FOLDERS)[number];

export class AdminConversationQueryDto {
  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @ApiPropertyOptional({ enum: CONVERSATION_FOLDERS, default: 'inbox' })
  @IsOptional()
  @IsIn(CONVERSATION_FOLDERS as unknown as string[])
  folder?: AdminConversationFolder;

  /** Narrow to threads carrying every one of these labels. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labelIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  /** SUPER_ADMIN in platform context only; ignored for shop owners. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Same ceiling as PaginationDto. Two different caps inside one admin app
   *  is how a page-size selector ends up offering a value the API rejects. */
  @ApiPropertyOptional({ default: 24, maximum: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit?: number = 24;
}
