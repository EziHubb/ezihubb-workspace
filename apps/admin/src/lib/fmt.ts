/**
 * Formatting utilities for the admin UI.
 * Re-exports the shared @mlh/utils library so existing imports continue to work.
 * Import directly from @mlh/utils in new code.
 */

export {
  fmtFixed,
  fmtCurrency,
  fmtAmount,
  fmtPercent,
  fmtNum,
  fmtRating,
} from '@mlh/utils';

export {
  safeArr,
  unwrapArr,
} from '@mlh/utils';
