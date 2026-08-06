import { IsString, IsOptional, MinLength, MaxLength, Matches, ValidateIf } from 'class-validator';

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

  @IsOptional()
  @ValidateIf((o) => o.description !== undefined && o.description !== '')
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description?: string;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}
