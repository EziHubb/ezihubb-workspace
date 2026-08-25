import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * One page of older messages.
 *
 * Cursor, not offset. A thread is written to while it is being read, so an
 * offset shifts under the reader: a message arriving between two "load older"
 * clicks pushes everything down one and the second page repeats a row the
 * first already showed. A cursor names a fixed point in the thread and is not
 * affected by anything appended after it.
 */
export class MessagePageQueryDto {
  /**
   * Load what comes BEFORE this message id — the oldest one currently on
   * screen. Absent asks for the newest page, which is what the conversation
   * endpoint already returns, so in practice this is always sent.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  before?: string;

  /**
   * Capped rather than trusted. Without a maximum this is an invitation to
   * ask for the entire thread in one request, which is the thing paging is
   * here to prevent.
   */
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
