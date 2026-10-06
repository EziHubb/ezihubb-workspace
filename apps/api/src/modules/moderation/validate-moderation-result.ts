import type { ModerationResult } from './dto/moderation-result.dto';

/** Model output is untrusted at runtime, regardless of the generic TS type. */
export function assertModerationResult(value: unknown): asserts value is ModerationResult {
  if (!value || typeof value !== 'object') throw new Error('Invalid moderation result');
  const v = value as Record<string, unknown>;
  if (!['CLEAN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(v.verdict as string) ||
      !Array.isArray(v.categories) || !v.categories.every((c) => typeof c === 'string') ||
      typeof v.confidence !== 'number' || !Number.isFinite(v.confidence) || v.confidence < 0 || v.confidence > 1 ||
      !(v.reasoning === null || typeof v.reasoning === 'string') ||
      !(v.sellerMessage === null || typeof v.sellerMessage === 'string')) {
    throw new Error('Invalid moderation result');
  }
}
