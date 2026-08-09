/**
 * Formatting utilities for the client app.
 * Re-exports from @ezihubb/utils so existing imports continue to work.
 * Import directly from @ezihubb/utils in new code.
 */

export {
  // numbers
  fmtFixed,
  fmtCurrency,
  fmtAmount,
  fmtPercent,
  fmtPercentRaw,
  fmtNum,
  fmtRating,
  parseAmount,
  clamp,
  // dates
  fmtDate,
  fmtDateTime,
  fmtTime,
  fmtDateISO,
  fmtRelative,
  isToday,
  // strings
  truncate,
  slugify,
  capitalize,
  titleCase,
  initials,
  isBlank,
  // arrays
  safeArr,
  unwrapArr,
  compact,
  unique,
  uniqueBy,
  sortBy,
  // null-safety
  safeNum,
  safeStr,
  safeGet,
  isNil,
  notNil,
  toBool,
} from '@ezihubb/utils';
