export type MoneyMode = 'LIVE' | 'TEST';
export type BeneficiaryKind = 'SELLER' | 'AFFILIATE';
export interface CapturedBalance {
  version: 'economic-v1'; currency: string; minorExponent: number; beneficiaryId: string;
  capturedMinor: string; availableMinor: string; pendingMinor: string; heldMinor: string;
  reservedMinor: string; paidMinor: string; debtMinor: string; payoutRequestsEnabled: boolean;
  minimumPayoutMinor: string;
}
export interface CapturedLot {
  id: string; orderId: string; captureId: string; sourceKey: string; capturedMinor: string;
  reservedMinor: string; paidMinor: string; holdReason: string | null; createdAt: string;
}
export interface CapturedPayout {
  id: string; amountMinor: string; state: 'REQUESTED' | 'VERIFYING' | 'PAID' | 'REJECTED';
  createdAt: string; processedAt: string | null; processedBy: string | null;
  verificationStartedAt: string | null; verificationStartedBy: string | null;
  transferReference: string | null; rejectionReason: string | null;
  allocations: { lotId: string; captureId: string; sourceKey: string; amountMinor: string }[];
}
export interface EconomicHistory<T> { data: T[]; total: number; page: number; limit: number }

export { formatCapturedUsd, usdInputToMinor, minorToUsdInput } from '@ezihubb/utils';
