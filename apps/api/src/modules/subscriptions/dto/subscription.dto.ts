import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { StoreSubscriptionCycle } from '@prisma/client';

export class GrantSubscriptionDto {
  @IsEnum(StoreSubscriptionCycle)
  cycle: StoreSubscriptionCycle;
  // Deliberately no price field — the server always reads the current list
  // price from PlatformSettings at grant time (see SubscriptionsService.grant).
  // A client-supplied price would let a typo (or a malicious caller) record
  // an arbitrary "amount paid" that was never actually charged/received.
}

export class ExtendSubscriptionDto {
  @IsInt()
  @Min(1)
  @Max(24)
  months: number;
}

export class RevokeSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
