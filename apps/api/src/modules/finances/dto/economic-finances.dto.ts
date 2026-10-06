import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { EconomicBeneficiaryKind, EconomicProvenance } from '@prisma/client';

export class EconomicBalanceQueryDto {
  @IsEnum(EconomicProvenance) provenance: EconomicProvenance = 'LIVE';
  @Matches(/^USD$/) currency = 'USD'; // Pilot has no FX or implicit exponent conversion.
}
export class EconomicHistoryQueryDto extends EconomicBalanceQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(48) limit = 20;
}
export class EconomicPayoutRequestDto extends EconomicBalanceQueryDto {
  @Matches(/^[1-9]\d{0,18}$/) amountMinor: string;
  @IsString() @MinLength(1) @MaxLength(100) idempotencyKey: string;
}
export class EconomicPayoutRejectDto {
  @IsString() @MinLength(1) @MaxLength(500) reason: string;
}
export class EconomicPayoutSettleDto {
  @Matches(/^[A-Za-z0-9_]{1,150}$/) reference: string;
}
export class EconomicAdminQueryDto extends EconomicHistoryQueryDto {
  @IsEnum(EconomicBeneficiaryKind) kind: EconomicBeneficiaryKind;
  @IsString() @MinLength(1) @MaxLength(150) beneficiaryId: string;
  @IsOptional() @IsString() @MaxLength(150) orderId?: string;
}
