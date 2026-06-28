/**
 * @phlix/tokens — framework-agnostic design tokens for Phlix.
 *
 * The single source of truth for theme tokens shared across web clients
 * (phlix-ui, windows, tizen) and non-CSS clients (React Native mobile, Roku).
 * Pure TypeScript: NO dependency on Vue / Pinia / vue-router.
 *
 *   Web:  import '@phlix/tokens/style.css';
 *   RN:   import { tokens, resolveTheme } from '@phlix/tokens';
 */

export {
  tokens,
  resolveTheme,
  type Tokens,
} from './tokens.generated';

export {
  type ThemeName,
  type Density,
  THEMES,
  DENSITIES,
  DEFAULT_THEME,
  DEFAULT_DENSITY,
  DATA_THEME,
  DATA_DENSITY,
  DATA_REDUCED_MOTION,
  type TokenAttributeOptions,
  type TokenTarget,
  applyTokenAttributes,
} from './themes';

export {
  type RGB,
  parseHex,
  toHex,
  lighten,
  darken,
  rgba,
  luminance,
  ACCENT_KEYS,
  ACCENT_INK_DARK,
  ACCENT_INK_LIGHT,
  deriveAccentVars,
} from './accent';
