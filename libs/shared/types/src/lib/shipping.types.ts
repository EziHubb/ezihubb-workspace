export interface ShippingEstimateStoreDto {
  storeId:    string;
  cost:       number;
  methodName: string;
  minDays:    number;
  maxDays:    number;
}

/** Aggregate delivery cost/timeline for a cart, resolved from each seller's
 *  own Delivery profile — see ShippingService.resolveSellerShippingCost(). */
export interface ShippingEstimateDto {
  /** False when any cart item lacks a resolvable delivery profile for the given destination. */
  resolvable: boolean;
  perStore:   ShippingEstimateStoreDto[];
  totalCost:  number;
  minDays:    number | null;
  maxDays:    number | null;
}
