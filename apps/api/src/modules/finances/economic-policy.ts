/** Prospective policy only: do not infer capture from an order lifecycle status. */
export const ECONOMIC_POLICY_VERSION = '2026-10-03.v1';
export const DEFAULT_STOCK_RESERVATION_TTL_SECONDS = 15 * 60;

/** Currency exponent is explicit; never assume every currency has cents. */
export function parseMinorUnits(amount: string, exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 3) {
    throw new Error('Unsupported currency exponent');
  }
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(amount);
  if (!match || (match[2]?.length ?? 0) > exponent) {
    throw new Error('Amount must be a non-negative exact decimal');
  }
  return BigInt(match[1]) * 10n ** BigInt(exponent)
    + BigInt((match[2] ?? '').padEnd(exponent, '0') || '0');
}

function nonNegative(value: bigint): void {
  if (typeof value !== 'bigint' || value < 0n) {
    throw new Error('Expected non-negative integer minor units');
  }
}

/** Largest remainder, ties by immutable line ID (not locale or input order). */
export function allocateMinorUnits(
  total: bigint,
  weights: ReadonlyArray<{ id: string; weight: bigint }>,
): Array<{ id: string; amount: bigint }> {
  nonNegative(total);
  const ids = new Set<string>();
  for (const row of weights) {
    nonNegative(row.weight);
    if (!row.id || ids.has(row.id)) throw new Error('Allocation IDs must be unique');
    ids.add(row.id);
  }
  const denominator = weights.reduce((sum, row) => sum + row.weight, 0n);
  if (denominator === 0n) {
    if (total !== 0n) throw new Error('Cannot allocate money to zero weight');
    return weights.map(({ id }) => ({ id, amount: 0n }));
  }
  const rows = weights.map(({ id, weight }) => ({
    id,
    amount: total * weight / denominator,
    remainder: total * weight % denominator,
  }));
  let remaining = total - rows.reduce((sum, row) => sum + row.amount, 0n);
  const priority = [...rows].sort((a, b) => a.remainder === b.remainder
    ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    : a.remainder > b.remainder ? -1 : 1);
  for (const row of priority) {
    if (remaining === 0n) break;
    row.amount += 1n;
    remaining -= 1n;
  }
  return rows.map(({ id, amount }) => ({ id, amount }));
}

/**
 * Cumulative floor difference: repeated partial refunds conserve the original
 * allocation exactly, including its last minor unit. Caller must serialize and
 * persist previousUnits; this pure function does not provide refund idempotency.
 */
export function refundByQuantity(
  originalAmount: bigint,
  quantity: number,
  previousUnits: number,
  additionalUnits: number,
): bigint {
  nonNegative(originalAmount);
  if (![quantity, previousUnits, additionalUnits].every(Number.isSafeInteger)
    || quantity <= 0 || previousUnits < 0 || additionalUnits <= 0
    || additionalUnits > quantity - previousUnits) {
    throw new Error('Refund quantity exceeds original allocation');
  }
  const total = BigInt(quantity);
  return originalAmount * BigInt(previousUnits + additionalUnits) / total
    - originalAmount * BigInt(previousUnits) / total;
}

/** Quote funding only, NOT an available balance or evidence of collected money. */
export function quoteFunding(input: {
  merchandise: bigint;
  sellerDiscount: bigint;
  platformDiscount: bigint;
  customerShipping: bigint;
  expectedShippingSubsidy: bigint;
}) {
  Object.values(input).forEach(nonNegative);
  if (input.sellerDiscount + input.platformDiscount > input.merchandise) {
    throw new Error('Discount exceeds merchandise');
  }
  // Expected shipping subsidy is neither seller credit nor actual platform spend.
  const sellerGross = input.merchandise - input.sellerDiscount + input.customerShipping;
  return {
    customerPayable: sellerGross - input.platformDiscount,
    platformMerchandiseFunding: input.platformDiscount,
    sellerGross,
    sellerShippingCredit: input.customerShipping,
    expectedShippingSubsidy: input.expectedShippingSubsidy,
  };
}

export function shippingRefund(input: {
  originallyCollected: bigint;
  previouslyRefunded: bigint;
  entireShopCancelled: boolean;
  handedOff: boolean;
  approvedOverride?: { amount: bigint; actorId: string; reason: string; evidenceId: string };
}): bigint {
  nonNegative(input.originallyCollected);
  nonNegative(input.previouslyRefunded);
  const remaining = input.originallyCollected - input.previouslyRefunded;
  if (remaining < 0n) throw new Error('Shipping refund exceeds collected shipping');
  if (input.approvedOverride) {
    const override = input.approvedOverride;
    nonNegative(override.amount);
    // Caller must verify SUPER_ADMIN authorization; these are audit references.
    if (!override.actorId.trim() || !override.reason.trim() || !override.evidenceId.trim()) {
      throw new Error('Shipping override requires approval evidence');
    }
    if (override.amount > remaining) throw new Error('Shipping refund exceeds remaining shipping');
    return override.amount;
  }
  return input.entireShopCancelled && !input.handedOff ? remaining : 0n;
}
