/**
 * Formatting utilities for the admin UI.
 * Re-exports the shared @ezihubb/utils library so existing imports continue to work.
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
  snakeToTitle,
  camelToTitle,
  isBlank,
  padStart,
  // arrays
  safeArr,
  unwrapArr,
  compact,
  unique,
  uniqueBy,
  groupBy,
  chunk,
  sumBy,
  sortBy,
  moveItem,
  // null-safety
  safeNum,
  safeStr,
  safeGet,
  isNil,
  notNil,
  toBool,
} from '@ezihubb/utils';
