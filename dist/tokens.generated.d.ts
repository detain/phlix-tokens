import type { ThemeName } from './themes';
export interface Tokens {
    base: Record<string, string>;
    nocturne: Record<string, string>;
    daylight: Record<string, string>;
    midnight: Record<string, string>;
    spacing: Record<string, string>;
    radius: Record<string, string>;
    shadow: Record<string, string>;
    motion: Record<string, string>;
    density: Record<'comfortable' | 'compact', Record<string, string>>;
    typography: Record<string, string>;
}
export declare const tokens: Tokens;
/**
 * Flat resolved token map for a theme — concrete values (var() refs resolved),
 * for React Native / Roku / any non-CSS consumer. clamp()/rgba() strings are
 * preserved as-is.
 */
export declare function resolveTheme(name: ThemeName): Record<string, string>;
