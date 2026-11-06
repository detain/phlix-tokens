/**
 * @phlix/tokens — framework-agnostic design tokens for Phlix.
 * @copyright 2026 Joe Huss <detain@interserver.net>
 *
 * The single source of truth for theme tokens shared across web clients
 * (phlix-ui directly; windows and tizen via its bundle) and INTENDED for
 * non-CSS clients (React Native mobile, Roku) when they migrate — the JS/JSON
 * maps exist for exactly that adoption; mobile/Roku do not depend on this
 * package yet.
 * Pure TypeScript: NO dependency on Vue / Pinia / vue-router.
 *
 *   Web:  import '@phlix/tokens/style.css';
 *   RN:   import { tokens, resolveTheme } from '@phlix/tokens';
 */
export { tokens, resolveTheme, type Tokens, } from './tokens.generated.js';
export { type ThemeName, type Density, THEMES, DENSITIES, THEME_SCHEMES, DEFAULT_THEME, DEFAULT_DENSITY, DATA_THEME, DATA_DENSITY, DATA_REDUCED_MOTION, type TokenAttributeOptions, type TokenTarget, applyTokenAttributes, } from './themes.js';
export { type RGB, parseHex, toHex, lighten, darken, rgba, luminance, ACCENT_KEYS, ACCENT_INK_DARK, ACCENT_INK_LIGHT, type AccentScheme, LIGHT_TEXT_REFERENCE, deriveAccentVars, } from './accent.js';
