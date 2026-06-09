export const LOYALTY_CONFIG = {
  POINTS_PER_DOLLAR:       10,    // earn 10 pts per $1 of order total
  POINT_VALUE:             0.01,  // 1 pt = $0.01 (100 pts = $1)
  MIN_REDEEM_POINTS:       100,   // minimum pts to redeem at checkout
  MAX_REDEEM_PERCENT:      0.50,  // points cannot cover more than 50% of order total
  LOCK_DAYS:               14,    // days after DELIVERED before pending → balance
} as const;
