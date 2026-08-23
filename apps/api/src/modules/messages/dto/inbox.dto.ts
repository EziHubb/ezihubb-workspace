import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const BULK_ACTIONS = [
  'star', 'unstar', 'read', 'unread', 'archive', 'trash', 'spam', 'restore',
] as const;

/**
 * Palette token names, not hex.
 *
 * A stored hex value survives a theme change and then clashes with everything
 * around it; a token is resolved at render time by whatever theme is current.
 */
export const LABEL_COLORS = ['muted', 'primary', 'success', 'warning', 'error'] as const;

export class BulkConversationDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  conversationIds!: string[];

  @ApiProperty({ enum: BULK_ACTIONS })
  @IsIn(BULK_ACTIONS as unknown as string[])
  action!: (typeof BULK_ACTIONS)[number];
}

export class CreateLabelDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional({ enum: LABEL_COLORS, default: 'muted' })
  @IsOptional()
  @IsIn(LABEL_COLORS as unknown as string[])
  color?: (typeof LABEL_COLORS)[number];
}

export class SetConversationLabelsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  labelIds!: string[];
}

export class SetBuyerNoteDto {
  /** Empty clears the note — see InboxService.setBuyerNote. */
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  body!: string;
}

export class SetAutoReplyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  message!: string;

  /** Null (or omitted with enabled=false) turns it off. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  activeUntil?: string | null;

  @ApiPropertyOptional({ description: 'false turns the auto-reply off regardless of activeUntil' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/** Create or rename one of a shop's saved message bodies. */
export class SnippetDto {
  @ApiProperty({ description: 'What the seller picks it out of the list by' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
