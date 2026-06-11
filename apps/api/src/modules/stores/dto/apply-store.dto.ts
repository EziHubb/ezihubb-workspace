import { IsString, IsEnum, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { StorePlanType } from '@prisma/client';

const RESERVED_SLUGS = ['admin', 'api', 'shops', 'products', 'cart', 'checkout', 'account', 'creators', 'pages'];

export class ApplyStoreDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens' })
  slug: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @IsEnum(StorePlanType)
  @IsOptional()
  planType?: StorePlanType;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}
