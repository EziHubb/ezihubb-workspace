import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { EconomicBeneficiaryKind, EconomicOperationKind, EconomicOperationState, EconomicProvenance } from '@prisma/client';

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

export class EconomicReconciliationQueryDto extends EconomicHistoryQueryDto {
  @IsOptional() @IsEnum(EconomicOperationState) state?: EconomicOperationState;
  @IsOptional() @IsEnum(EconomicOperationKind) kind?: EconomicOperationKind;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) orderId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) storeId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) reference?: string;
}

class RefundLineDto {
  @IsString() @MinLength(1) @MaxLength(180) partKey: string;
  @IsInt() @Min(1) @Max(2147483647) quantity: number;
}
export class EconomicRefundPrepareDto {
  @IsOptional() @IsBoolean() approveGiftWrap?: boolean;
  @IsString() @MinLength(1) @MaxLength(500) reason: string;
  @Matches(/^[A-Za-z0-9:_-]{1,80}$/) idempotencyKey: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RefundLineDto) selection: RefundLineDto[];
}
export class EconomicRefundExecuteDto {
  @IsOptional() @Matches(/^[A-Za-z0-9_]{1,150}$/) reference?: string;
}
export class EconomicShippingRefundOverrideDto {
  @IsString() @MinLength(1) @MaxLength(180) partKey: string;
  @Matches(/^[1-9]\d{0,18}$/) amountMinor: string;
  @IsString() @MinLength(1) @MaxLength(150) evidenceReference: string;
  @IsString() @MinLength(1) @MaxLength(500) reason: string;
  @Matches(/^[A-Za-z0-9:_-]{1,80}$/) idempotencyKey: string;
}
export class EconomicLifecycleRecoveryDto {
  @IsString() @MinLength(1) @MaxLength(500) reason: string;
}
export class EconomicExternalEffectsQueryDto extends EconomicHistoryQueryDto {
  @IsOptional() @Matches(/^(POD_PRINTIFY|EMAIL_TRANSACTIONAL)$/) kind?: string;
  @IsOptional() @IsEnum(EconomicOperationState) state?: EconomicOperationState;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) orderId?: string;
}
