/** Exact USD formatting/input for captured finance contracts. Never use Number for money. */
export function formatCapturedUsd(value: string) {
  if (!/^-?\d+$/.test(value)) throw new Error('Invalid monetary response');
  const amount = BigInt(value), absolute = amount < BigInt(0) ? -amount : amount;
  return `${amount < BigInt(0) ? '-' : ''}$${(absolute / BigInt(100)).toLocaleString('en-US')}.${(absolute % BigInt(100)).toString().padStart(2, '0')}`;
}
export function usdInputToMinor(value: string): string | null {
  const match = /^(0|[1-9]\d{0,16})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const amount = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0'));
  return amount > BigInt(0) && amount <= BigInt('9223372036854775807') ? amount.toString() : null;
}
export function minorToUsdInput(value: string) {
  const amount = BigInt(value);
  return `${amount / BigInt(100)}.${(amount % BigInt(100)).toString().padStart(2, '0')}`;
}
