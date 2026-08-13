import { Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Max, Min,
} from 'class-validator';

export class UpdateBankAccountDto {
  @IsString() @Length(1, 200)
  accountHolderName!: string;

  @IsString() @Length(1, 200)
  bankName!: string;

  @IsString() @Length(4, 34)
  accountNumber!: string;

  @IsString() @Length(2, 2)
  country!: string;

  @IsIn(['WEEKLY', 'BIWEEKLY', 'MONTHLY'])
  depositSchedule!: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
}

export class ConfirmBillingCardDto {
  @IsString()
  stripePaymentMethodId!: string;
}

export class UpdateCurrencyDto {
  @IsString() @Length(3, 3)
  currency!: string;
}

export class UpdateAutoBillingDto {
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateTaxInfoDto {
  @IsIn(['INDIVIDUAL', 'BUSINESS'])
  sellerType!: 'INDIVIDUAL' | 'BUSINESS';

  @IsString() @Length(1, 200)
  fullLegalName!: string;

  @IsOptional() @IsString() @Length(0, 50)
  taxpayerId?: string;

  @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @IsString() @Length(2, 2)
  country!: string;

  @IsString() @Length(1, 300)
  streetAddress!: string;

  @IsOptional() @IsString() @Length(0, 300)
  flatOther?: string;

  @IsString() @Length(1, 150)
  city!: string;

  @IsOptional() @IsString() @Length(0, 150)
  province?: string;

  @IsOptional() @IsString() @Length(0, 20)
  postCode?: string;

  @IsOptional() @IsString() @Length(0, 30)
  phone?: string;
}

export class ActivitiesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  month?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  year?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
