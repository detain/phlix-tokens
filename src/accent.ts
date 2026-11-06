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

/** Relative luminance (WCAG 2.1) for picking readable ink on a fill. */
export function luminance({ r, g, b }: RGB): number {
  const ch = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

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
export const ACCENT_INK_DARK = '#2a1804';
export const ACCENT_INK_LIGHT = '#fff8ec';

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
export const ACCENT_KEYS = [
  '--accent',
  '--accent-hover',
  '--accent-active',
  '--accent-soft',
  '--accent-ring',
  '--accent-text',
  '--accent-contrast',
] as const;

/**
 * Reference surface for the light-scheme accent-text law: daylight
 * `--surface-3`, the darkest background any light theme ships. A dark
 * foreground's WCAG ratio rises monotonically as the background lightens, so
 * a hue that clears AA here clears --bg, --surface, --surface-2 and white.
 * Pinned by the light-scheme derivation tests against every light surface.
 */
export const LIGHT_TEXT_REFERENCE = '#e8dcc6';

/** WCAG 2.1 AA for normal-size text — the same threshold the contrast guard pins. */
const WCAG_AA_TEXT = 4.5;

/** Safety bound for the accent-text walk. Measured worst case: 10 passes from
 *  pure white (the highest-luminance input), so no real color reaches it. */
const LIGHT_TEXT_PASSES = 25;

/** WCAG ratio between two resolved RGB triples (skips the hex round-trip). */
function contrastBetween(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The continuous form of the colors.css light-block law (`--accent-text:
 * var(--amber-800)` under an amber-500 fill): darken the hue toward black in
 * the same proportional steps `darken` uses until it clears AA against
 * LIGHT_TEXT_REFERENCE. Hues that already clear are returned unchanged, so
 * already-dark accents survive byte-identical. Same approximation
 * relationship to the discrete ramp that hover/active already have.
 */
function darkenToLightTextAA(rgb: RGB): RGB {
  const reference = parseHex(LIGHT_TEXT_REFERENCE);
  if (!reference) {
    throw new Error('LIGHT_TEXT_REFERENCE must be a parseable hex — this is a source bug');
  }
  let step = { ...rgb };
  let passes = 0;
  while (contrastBetween(step, reference) < WCAG_AA_TEXT) {
    if (passes >= LIGHT_TEXT_PASSES) {
      // Unreachable for real input (worst measured case is 10 passes); fail
      // loudly rather than ship a silently-under-AA text role.
      throw new Error(`accent-text could not clear AA within ${LIGHT_TEXT_PASSES} passes`);
    }
    step = darken(step, 0.1);
    passes++;
  }
  return step;
}

/**
 * Derive the full accent role set from a single accent hex — used when the
 * user overrides the default amber via the accent picker. Returns CSS
 * custom-property values matching the token contract (hover/active/soft/
 * ring/text/contrast). The optional `scheme` selects the colors.css law for
 * the text role; the default keeps every 1-argument caller on the dark-theme
 * behavior (text role = accent hue itself), which is exactly what the dark
 * blocks declare. Pass 'light' for a light-scheme target (see THEME_SCHEMES).
 */
export function deriveAccentVars(
  hex: string,
  scheme: AccentScheme = 'dark',
): Record<string, string> | null {
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
    // LW-073: the text role follows the scheme law, not the fill — on light
    // surfaces the raw hue measures 1.82–2.01:1 and must be darkened to AA.
    '--accent-text': scheme === 'light' ? toHex(darkenToLightTextAA(rgb)) : toHex(rgb),
    '--accent-contrast': contrast,
  };
}
