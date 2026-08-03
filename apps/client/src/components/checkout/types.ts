import type { ShippingOptionDto } from '@ezihubb/types';

// Re-exported so checkout sub-components share a single source of truth
export type { ShippingAddressInput } from '@ezihubb/api-client';

export interface CheckoutStep {
  id:    1 | 2 | 3;
  label: string;
}

export interface CheckoutState {
  step:             1 | 2 | 3;
  completedSteps:   number[];
  shippingAddress:  import('@ezihubb/api-client').ShippingAddressInput | null;
  guestEmail:       string;
  shippingMethod:   ShippingOptionDto | null;
  /** Set after order is submitted in step 3 */
  orderId:          string | null;
  orderNumber:      string | null;
}
