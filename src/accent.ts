/**
 * Pure color helpers + accent-variable derivation, ported verbatim from
 * phlix-ui's `src/composables/color.ts`. No Vue, no DOM, no deps — safe to import
 * from React Native / Roku tooling.
 *
 * `deriveAccentVars(hex)` derives the full accent role set from a single accent
 * hex (used when a user overrides the default amber via the accent picker).
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Parse #rgb / #rrggbb (with or without leading #). Returns null if unparseable. */
export function parseHex(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
export const toHex = ({ r, g, b }: RGB): string =>
  '#' + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('');

/** Mix `amount` (0–1) of white into the color. */
export function lighten(rgb: RGB, amount: number): RGB {
  return { r: rgb.r + (255 - rgb.r) * amount, g: rgb.g + (255 - rgb.g) * amount, b: rgb.b + (255 - rgb.b) * amount };
}
/** Mix `amount` (0–1) of black into the color. */
export function darken(rgb: RGB, amount: number): RGB {
  return { r: rgb.r * (1 - amount), g: rgb.g * (1 - amount), b: rgb.b * (1 - amount) };
}
export const rgba = ({ r, g, b }: RGB, a: number): string => `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, ${a})`;

/** Relative luminance (WCAG) for picking readable ink on a fill. */
export function luminance({ r, g, b }: RGB): number {
  const ch = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * The CSS custom-property keys produced by `deriveAccentVars`. Mirrors the accent
 * role contract in colors.css; consumers can use this to clear an override and
 * fall back to the theme amber.
 */
/**
 * Single source of truth for the accent "ink" (the readable text/icon color laid
 * on top of an accent fill). `deriveAccentVars` (the runtime accent-picker path)
 * and the static CSS `--accent-contrast` in `src/css/colors.css` MUST agree on
 * these values — they previously drifted (`#1a1205` here vs `#2a1804` in CSS).
 *
 * `ACCENT_INK_DARK` (`#2a1804`) is the canonical dark ink and matches
 * `--accent-contrast` in colors.css line ~30 verbatim, so the CSS default is
 * unchanged. `ACCENT_INK_LIGHT` (`#fff8ec`) equals `--amber-50`.
 */
export const ACCENT_INK_DARK = '#2a1804';
export const ACCENT_INK_LIGHT = '#fff8ec';

export const ACCENT_KEYS = [
  '--accent',
  '--accent-hover',
  '--accent-active',
  '--accent-soft',
  '--accent-ring',
  '--accent-contrast',
] as const;

/**
 * Derive the full accent role set from a single accent hex — used when the user
 * overrides the default amber via the accent picker. Returns CSS custom-property
 * values matching the token contract (hover/active/soft/ring/contrast).
 */
export function deriveAccentVars(hex: string): Record<string, string> | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  // Single source of truth shared with colors.css `--accent-contrast`; see
  // ACCENT_INK_DARK / ACCENT_INK_LIGHT above.
  const contrast = luminance(rgb) > 0.45 ? ACCENT_INK_DARK : ACCENT_INK_LIGHT;
  return {
    '--accent': toHex(rgb),
    '--accent-hover': toHex(lighten(rgb, 0.12)),
    '--accent-active': toHex(darken(rgb, 0.12)),
    '--accent-soft': rgba(rgb, 0.14),
    '--accent-ring': rgba(rgb, 0.55),
    '--accent-contrast': contrast,
  };
}
