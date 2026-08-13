export type SellerLedgerEntryType =
  | 'SALE' | 'TRANSACTION_FEE' | 'PAYMENT_PROCESSING_FEE' | 'REGULATORY_FEE'
  | 'LISTING_FEE' | 'ADJUSTMENT' | 'VAT' | 'DEPOSIT_FEE';

export type DepositSchedule = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type SellerType = 'INDIVIDUAL' | 'BUSINESS';

export interface FinancesBankAccountDto {
  accountHolderName: string;
  bankName: string;
  accountNumberLast4: string;
  country: string;
  depositSchedule: DepositSchedule;
  updatedAt: string;
}

export interface FinancesBillingCardDto {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName: string;
  isDefault: boolean;
}

export interface FinancesOverviewDto {
  current: number;
  pending: number;
  total: number;
  depositMinAmount: number;
  hasFundsReadyForDeposit: boolean;
  bankAccount: FinancesBankAccountDto | null;
  currency: string;
  autoBillingEnabled: boolean;
  defaultCard: FinancesBillingCardDto | null;
  amountDueThisMonth: number;
  nothingDueThisMonth: boolean;
}

export interface FinancesActivitySummaryDto {
  netProfit: number;
  sales: {
    total: number;
    totalSalesCount: number;
    refunds: number;
    salesTaxRemitted: number;
    vatRemitted: number;
  };
  fees: {
    total: number;
    listingFees: number;
    transactionFees: number;
    processingFees: number;
    regulatoryFee: number;
    depositFees: number;
    vatOnFees: number;
  };
  marketing: { total: number; etsyAds: number; offsiteAds: number };
}

/** A monthly-statement row is either a real ledger entry, or a synthetic
 *  "PAYOUT" withdrawal event folded in server-side so the running balance
 *  reflects money actually leaving the account. */
export type FinancesLedgerRowType = SellerLedgerEntryType | 'PAYOUT';

export interface FinancesLedgerEntryDto {
  id: string;
  date: string;
  type: FinancesLedgerRowType;
  description: string;
  storeOrderId: string | null;
  amount: number;
  balance: number;
}

export interface FinancesActivitiesDto {
  data: FinancesLedgerEntryDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface FinancesTaxInfoDto {
  sellerType: SellerType;
  fullLegalName: string;
  taxpayerIdLast4: string | null;
  dateOfBirth: string | null;
  country: string;
  streetAddress: string;
  flatOther: string | null;
  city: string;
  province: string | null;
  postCode: string | null;
  phone: string | null;
}
