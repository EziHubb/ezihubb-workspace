import { Transform } from 'class-transformer';
import { IsBooleanString, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** Buckets for the dispatch promise. Named, not date ranges, because the
 *  boundaries move with the server's clock and a client sending its own would
 *  disagree with the badge counts. */
export const SHIP_BY_BUCKETS = ['all', 'overdue', 'today', 'tomorrow', 'week', 'none'] as const;
export type ShipByBucket = (typeof SHIP_BY_BUCKETS)[number];

export const QUEUE_SORTS = ['shipBy', 'newest', 'oldest', 'total'] as const;
export type QueueSort = (typeof QUEUE_SORTS)[number];

export const QUEUE_VIEWS = ['active', 'cancelled'] as const;
export type QueueView = (typeof QUEUE_VIEWS)[number];

/** `?flag=true` arrives as a string; anything else means "not filtering on it". */
const toOptionalBool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : undefined;

export class OrderQueueQueryDto extends PaginationDto {
  /** SUPER_ADMIN in platform context only; ignored for shop owners. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  /** The pipeline tab. Omitted means every step. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stepId?: string;

  /** Active fulfilment pipeline or the read-only cancellation archive. */
  @ApiPropertyOptional({ enum: QUEUE_VIEWS })
  @IsOptional()
  @IsIn(QUEUE_VIEWS as unknown as string[])
  view?: QueueView;

  @ApiPropertyOptional({ enum: SHIP_BY_BUCKETS })
  @IsOptional()
  @IsIn(SHIP_BY_BUCKETS as unknown as string[])
  shipBy?: ShipByBucket;

  /** ISO 3166-1 alpha-2, or omitted for anywhere. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  @Transform(toOptionalBool)
  hasNote?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  @Transform(toOptionalBool)
  isGift?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  @Transform(toOptionalBool)
  isPersonalized?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  @Transform(toOptionalBool)
  upgradeRequested?: boolean;

  @ApiPropertyOptional({ description: 'Order number or buyer name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: QUEUE_SORTS })
  @IsOptional()
  @IsIn(QUEUE_SORTS as unknown as string[])
  sort?: QueueSort;
}
