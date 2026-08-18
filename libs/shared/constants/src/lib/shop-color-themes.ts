// Single source of truth for the 12 Shop Home colour-theme swatches — used by
// both the admin picker (apps/admin/.../settings/shop-home) and the public
// storefront render (apps/client/.../shops/[slug]). Do not duplicate these
// hex values anywhere else.
//
// Hex values sampled from the real "Colour theme" reference screenshot
// (docs/etsy-assets/theme colors.jpg — no longer present in this repo, was a
// scratch file from an earlier session) via scanline edge-detection to find
// each circle's true center, then a 5x5 pixel patch average to smooth out
// JPEG compression noise. Not estimated by eye.
//
// `textSafeHex` — 6 of the 12 colors (cream, tan, orange, sage, clay, gold)
// are too light to use as a TEXT/underline/border color on the storefront's
// light page background: cream on white is only 1.46:1, far under the 4.5:1
// AA threshold. Computed by holding hue/saturation constant and reducing HSL
// lightness in 1% steps until contrast against white clears 4.5:1 — the
// minimal darkening needed, not an arbitrary shade. The other 6 are already
// dark enough (7.38:1–13.98:1 vs white) so textSafeHex === hex.
//
// Use `hex` for solid swatches/fills (colour picker, banner gradient — no
// text sits on it); use `textSafeHex` anywhere the color itself becomes
// text, an underline, or a border (tab-nav active state, Follow button).
//
// NOTE: nothing in this codebase renders text on a SOLID fill of these
// colors — the Follow button and tab-nav put `textSafeHex` text on a 10%
// tint, not on a solid background. So there is deliberately NO
// white-or-black-by-luminance field here. See docs/etsy-ui-audit.md before
// adding one.

export interface ShopColorTheme {
  value:  string;
  label:  string;
  hex:    string;
  /** Safe to use as this color's OWN text/underline/border color on a light page background — see note above. */
  textSafeHex: string;
}

export const SHOP_COLOR_THEMES: ShopColorTheme[] = [
  { value: 'cream',    label: 'Cream',    hex: '#F1D291', textSafeHex: '#986D13' },
  { value: 'tan',      label: 'Tan',      hex: '#CAA475', textSafeHex: '#956C39' },
  { value: 'orange',   label: 'Orange',   hex: '#E09C49', textSafeHex: '#A7681C' },
  { value: 'sage',     label: 'Sage',     hex: '#8B9469', textSafeHex: '#727956' },
  { value: 'clay',     label: 'Clay',     hex: '#A07251', textSafeHex: '#996D4E' },
  { value: 'gold',     label: 'Gold',     hex: '#9D743C', textSafeHex: '#966F39' },
  { value: 'olive',    label: 'Olive',    hex: '#6E502A', textSafeHex: '#6E502A' },
  { value: 'mustard',  label: 'Mustard',  hex: '#876110', textSafeHex: '#876110' },
  { value: 'maroon',   label: 'Maroon',   hex: '#5C2C2C', textSafeHex: '#5C2C2C' },
  { value: 'forest',   label: 'Forest',   hex: '#51572B', textSafeHex: '#51572B' },
  { value: 'brown',    label: 'Brown',    hex: '#5A2B19', textSafeHex: '#5A2B19' },
  { value: 'burgundy', label: 'Burgundy', hex: '#541424', textSafeHex: '#541424' },
];

const THEME_BY_VALUE = new Map(SHOP_COLOR_THEMES.map((t) => [t.value, t]));

/**
 * Looks up a theme by its stored `value`. Returns null for:
 *  - null/undefined (no theme selected, or not entitled — server already
 *    nulls this out for non-Plus stores in getStoreBySlug)
 *  - any string not in the 12-entry palette (stale data from before a
 *    palette change, or a hand-edited DB value) — callers must fall back to
 *    the default look, never throw.
 */
export function getShopColorTheme(value: string | null | undefined): ShopColorTheme | null {
  if (!value) return null;
  return THEME_BY_VALUE.get(value) ?? null;
}
