export type MoneyMode = 'LIVE' | 'TEST';
export type BeneficiaryKind = 'SELLER' | 'AFFILIATE';
export interface CapturedBalance {
  version: 'economic-v1'; currency: string; minorExponent: number; beneficiaryId: string;
  capturedMinor: string; availableMinor: string; pendingMinor: string; heldMinor: string;
  reservedMinor: string; paidMinor: string; debtMinor: string; payoutRequestsEnabled: boolean;
  minimumPayoutMinor: string;
  reversedMinor?: string; debtRecoveredMinor?: string; debtRecoveryEnabled?: boolean;
}
export interface CapturedLot {
  id: string; orderId: string; captureId: string; sourceKey: string; capturedMinor: string;
  reservedMinor: string; paidMinor: string; holdReason: string | null; createdAt: string;
  reversedMinor?: string; debtRecoveredMinor?: string;
}
export interface CapturedPayout {
  id: string; amountMinor: string; state: 'REQUESTED' | 'VERIFYING' | 'PAID' | 'REJECTED';
  createdAt: string; processedAt: string | null; processedBy: string | null;
  verificationStartedAt: string | null; verificationStartedBy: string | null;
  transferReference: string | null; rejectionReason: string | null;
  allocations: { lotId: string; captureId: string; sourceKey: string; amountMinor: string }[];
}
export interface EconomicHistory<T> { data: T[]; total: number; page: number; limit: number }

export interface ReconciliationOperation {
  id: string; orderId: string; orderNumber: string; kind: string; state: string;
  provider: string; providerReference: string | null; currency: string; provenance: MoneyMode; minorExponent: number;
  expectedMinor: string; verifiedMinor: string | null; differenceMinor: string | null;
  evidenceStatus: 'CAPTURE_VERIFIED' | 'REFUND_VERIFIED' | 'NOT_VERIFIED'; captureId: string | null;
  createdAt: string; dispatchedAt: string | null; reconcileAfter: string | null;
  completedAt: string | null; verifiedAt: string | null;
  refundRequest: { id: string; captureId: string; requestedBy: string; reason: string; createdAt: string; platformRoundingMinor: string } | null;
}
export interface ReconciliationHistory extends EconomicHistory<ReconciliationOperation> {
  version: 'economic-v1'; provenance: MoneyMode; currency: string; readOnly: true;
}

export { formatCapturedUsd, usdInputToMinor, minorToUsdInput } from '@ezihubb/utils';
