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
export declare function parseHex(hex: string): RGB | null;
export declare const toHex: ({ r, g, b }: RGB) => string;
/** Mix `amount` (0–1) of white into the color. */
export declare function lighten(rgb: RGB, amount: number): RGB;
/** Mix `amount` (0–1) of black into the color. */
export declare function darken(rgb: RGB, amount: number): RGB;
export declare const rgba: ({ r, g, b }: RGB, a: number) => string;
/** Relative luminance (WCAG) for picking readable ink on a fill. */
export declare function luminance({ r, g, b }: RGB): number;
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
export declare const ACCENT_INK_DARK = "#2a1804";
export declare const ACCENT_INK_LIGHT = "#fff8ec";
export declare const ACCENT_KEYS: readonly ["--accent", "--accent-hover", "--accent-active", "--accent-soft", "--accent-ring", "--accent-contrast"];
/**
 * Derive the full accent role set from a single accent hex — used when the user
 * overrides the default amber via the accent picker. Returns CSS custom-property
 * values matching the token contract (hover/active/soft/ring/contrast).
 */
export declare function deriveAccentVars(hex: string): Record<string, string> | null;
