/**
 * Pure color helpers + accent-variable derivation, ported verbatim from
 * phlix-ui's `src/composables/color.ts`. No Vue, no DOM, no deps — safe to import
 * from React Native / Roku tooling.
 *
 * `deriveAccentVars(hex, scheme?)` derives the full accent role set from a
 * single accent hex (used when a user overrides the default amber via the
 * accent picker; the scheme selects the colors.css accent-text law).
 * @copyright 2026 Joe Huss <detain@interserver.net>
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
/** Relative luminance (WCAG 2.1) for picking readable ink on a fill. */
export declare function luminance({ r, g, b }: RGB): number;
/**
 * Single source of truth for the accent "ink" (the readable text/icon color laid
 * on top of an accent fill). `deriveAccentVars` (the runtime accent-picker path)
 * and the static CSS `--accent-contrast` in `src/css/colors.css` MUST agree on
 * these values — they previously drifted (`#1a1205` here vs `#2a1804` in CSS).
 *
 * `ACCENT_INK_DARK` (`#2a1804`) is the canonical dark ink and matches the
 * `--accent-contrast` declaration in `src/css/colors.css` verbatim (cited by
 * name, not line number — the file's declarations shift), so the CSS default is
 * unchanged. `ACCENT_INK_LIGHT` (`#fff8ec`) equals `--amber-50`.
 */
export declare const ACCENT_INK_DARK = "#2a1804";
export declare const ACCENT_INK_LIGHT = "#fff8ec";
/**
 * Which branch of the colors.css accent-text law a derivation follows. The
 * dark themes render accent text with the accent hue itself (`--accent-text:
 * var(--amber-500)` — AA on their dark bg/surface); light themes must darken
 * it until it clears AA on their surfaces (daylight ships `var(--amber-800)`
 * under its amber fill). `THEME_SCHEMES` in themes.ts maps each theme to its
 * branch and is pinned against colors.css's own `color-scheme:` declarations.
 */
export type AccentScheme = 'dark' | 'light';
/**
 * The CSS custom-property keys produced by `deriveAccentVars`. Mirrors the
 * accent role contract in colors.css — test/tokens.test.ts pins this set, by
 * name, against the accent names parsed from colors.css itself (LW-073: the
 * set omitted `--accent-text`, so overrides painted the fill roles and left
 * the text role on the theme ramp). Consumers use this to clear an override
 * and fall back to the theme amber.
 */
export declare const ACCENT_KEYS: readonly ["--accent", "--accent-hover", "--accent-active", "--accent-soft", "--accent-ring", "--accent-text", "--accent-contrast"];
/**
 * Reference surface for the light-scheme accent-text law: daylight
 * `--surface-3`, the darkest background any light theme ships. A dark
 * foreground's WCAG ratio rises monotonically as the background lightens, so
 * a hue that clears AA here clears --bg, --surface, --surface-2 and white.
 * Pinned by the light-scheme derivation tests against every light surface.
 */
export declare const LIGHT_TEXT_REFERENCE = "#e8dcc6";
/**
 * Derive the full accent role set from a single accent hex — used when the
 * user overrides the default amber via the accent picker. Returns CSS
 * custom-property values matching the token contract (hover/active/soft/
 * ring/text/contrast). The optional `scheme` selects the colors.css law for
 * the text role; the default keeps every 1-argument caller on the dark-theme
 * behavior (text role = accent hue itself), which is exactly what the dark
 * blocks declare. Pass 'light' for a light-scheme target (see THEME_SCHEMES).
 */
export declare function deriveAccentVars(hex: string, scheme?: AccentScheme): Record<string, string> | null;
