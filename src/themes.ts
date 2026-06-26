/**
 * Theme / density type unions + the DOM attribute contract, ported (Vue-free)
 * from phlix-ui's preferences store and `useTheme` composable.
 *
 * The attribute names below are the single source of truth for how a web client
 * reflects a theme onto an element (`<html>` in practice): `data-theme`,
 * `data-density`, `data-reduced-motion`. The token CSS is scoped to these exact
 * selectors, so they must stay in lockstep with `src/css/*.css`.
 */

import { deriveAccentVars, ACCENT_KEYS } from './accent';

export type ThemeName = 'nocturne' | 'daylight' | 'midnight';
export type Density = 'comfortable' | 'compact';

/** All selectable themes, in canonical order. */
export const THEMES: readonly ThemeName[] = ['nocturne', 'daylight', 'midnight'] as const;

/** All selectable densities, in canonical order. */
export const DENSITIES: readonly Density[] = ['comfortable', 'compact'] as const;

/** First-time / fallback theme — Nocturne (the dark default `:root` resolves to). */
export const DEFAULT_THEME: ThemeName = 'nocturne';

/** First-time / fallback density. */
export const DEFAULT_DENSITY: Density = 'comfortable';

/** DOM attribute that selects the active theme block in the token CSS. */
export const DATA_THEME = 'data-theme';
/** DOM attribute that selects the active density block in the token CSS. */
export const DATA_DENSITY = 'data-density';
/** DOM attribute that forces the reduced-motion path (set to the string 'true'). */
export const DATA_REDUCED_MOTION = 'data-reduced-motion';

/** Options for `applyTokenAttributes`. */
export interface TokenAttributeOptions {
  theme: ThemeName;
  density: Density;
  /** When true, sets data-reduced-motion='true'; when false, removes it. */
  reducedMotion?: boolean;
  /** Optional accent hex override. When provided + parseable, sets the accent
   *  custom properties inline; when null/omitted/unparseable the accent vars are
   *  cleared so the theme's default amber applies. */
  accent?: string | null;
}

/** Minimal element surface used by `applyTokenAttributes` — satisfied by an
 *  `HTMLElement` without pulling in the DOM lib at the type level. */
export interface TokenTarget {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  style: {
    setProperty(prop: string, value: string): void;
    removeProperty(prop: string): void;
  };
}

/**
 * Reflect a theme/density/reduced-motion (+ optional accent override) onto a DOM
 * element. Pure aside from the element mutation, and a no-op when no DOM is
 * available (guarded via `typeof document`) and no explicit element is passed —
 * so it is safe to call in SSR / React Native bundles. Mirrors phlix-ui
 * `applyToRoot`, minus Vue reactivity.
 */
export function applyTokenAttributes(
  el: TokenTarget | null | undefined,
  opts: TokenAttributeOptions,
): void {
  const target =
    el ?? (typeof document !== 'undefined' ? (document.documentElement as unknown as TokenTarget) : null);
  if (!target) return;

  target.setAttribute(DATA_THEME, opts.theme);
  target.setAttribute(DATA_DENSITY, opts.density);

  if (opts.reducedMotion) target.setAttribute(DATA_REDUCED_MOTION, 'true');
  else target.removeAttribute(DATA_REDUCED_MOTION);

  const vars = opts.accent ? deriveAccentVars(opts.accent) : null;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) target.style.setProperty(k, v);
  } else {
    for (const k of ACCENT_KEYS) target.style.removeProperty(k); // fall back to theme amber
  }
}
