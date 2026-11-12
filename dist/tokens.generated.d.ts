import type { ThemeName } from './themes.js';
export interface Tokens {
    base: Record<string, string>;
    nocturne: Record<string, string>;
    daylight: Record<string, string>;
    midnight: Record<string, string>;
    spacing: Record<string, string>;
    radius: Record<string, string>;
    shadow: Record<ThemeName, Record<string, string>>;
    motion: Record<string, string>;
    density: Record<'comfortable' | 'compact', Record<string, string>>;
    typography: Record<string, string>;
}
export declare const tokens: Tokens;
/**
 * Flat resolved token map for a theme — concrete values (var() refs resolved),
 * for React Native / Roku / any non-CSS consumer. clamp()/rgba() strings are
 * preserved as-is.
 *
 * Density: the map carries the COMFORTABLE density values (`--control-h`,
 * `--control-pad-x`, …), because density.css folds `comfortable` into `:root`.
 * There is no density parameter; for compact, spread the variant over it:
 *   `{ ...resolveTheme(name), ...tokens.density.compact }`
 */
export declare function resolveTheme(name: ThemeName): Record<string, string>;
