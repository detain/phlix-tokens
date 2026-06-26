#!/usr/bin/env node
/**
 * generate-tokens.mjs — parse src/css/*.css, extract every `--var: value;`
 * grouped by selector, resolve `var(--ref)` chains within a theme, and write
 * src/tokens.generated.ts (+ .json). Deterministic, no network, re-runnable.
 *
 * Selector model:
 *   :root                         → base vars (theme-invariant + Nocturne defaults)
 *   [data-theme='nocturne']       → nocturne overrides   (also folded with :root,nocturne groups)
 *   [data-theme='daylight']       → daylight overrides
 *   [data-theme='midnight']       → midnight overrides
 *   [data-density='comfortable']  → density: comfortable
 *   [data-density='compact']      → density: compact
 *
 * `tokens.base` = all `:root`-scoped vars (across every css file), with var()
 * refs resolved against base only. Each theme object = the theme's own declared
 * vars resolved against (base ∪ that theme). `resolveTheme(name)` returns the
 * flat merge base ∪ theme.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_DIR = join(__dirname, '..', 'src', 'css');
const OUT_TS = join(__dirname, '..', 'src', 'tokens.generated.ts');
const OUT_JSON = join(__dirname, '..', 'src', 'tokens.generated.json');

const THEME_NAMES = ['nocturne', 'daylight', 'midnight'];
const DENSITY_NAMES = ['comfortable', 'compact'];

/** Strip CSS block comments. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Parse a CSS string into an array of { selectors:[], decls:[{prop,value}] }
 * rule blocks. Only flat top-level rules are needed (token files have no nesting
 * besides @import which we skip). Handles comma-separated selector lists.
 */
function parseRules(css) {
  const out = [];
  const src = stripComments(css);
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(src)) !== null) {
    const rawSel = m[1].trim();
    if (!rawSel || rawSel.startsWith('@')) continue; // skip @import etc.
    const selectors = rawSel.split(',').map((s) => s.trim()).filter(Boolean);
    const decls = [];
    for (const part of m[2].split(';')) {
      const idx = part.indexOf(':');
      if (idx === -1) continue;
      const prop = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (!prop.startsWith('--')) continue; // only custom properties
      decls.push({ prop, value });
    }
    if (decls.length) out.push({ selectors, decls });
  }
  return out;
}

/** Classify a selector into a token group key, or null to ignore. */
function classify(selector) {
  if (selector === ':root') return 'base';
  for (const t of THEME_NAMES) {
    if (selector === `[data-theme='${t}']` || selector === `[data-theme="${t}"]`) return `theme:${t}`;
  }
  for (const d of DENSITY_NAMES) {
    if (selector === `[data-density='${d}']` || selector === `[data-density="${d}"]`) return `density:${d}`;
  }
  return null;
}

/**
 * Resolve `var(--ref[, fallback])` chains within a single scope map. Iterative
 * with a fixpoint; unresolved refs fall through to their fallback or are left
 * as a literal var() string (e.g. a ref to a property that lives in another
 * scope). Deterministic.
 */
function resolveValue(value, scope, seen = new Set()) {
  const varRe = /var\(\s*(--[\w-]+)\s*(?:,([^()]*(?:\([^()]*\)[^()]*)*))?\)/;
  let v = value;
  let guard = 0;
  while (varRe.test(v) && guard < 50) {
    guard++;
    v = v.replace(varRe, (_full, ref, fallback) => {
      if (Object.prototype.hasOwnProperty.call(scope, ref) && !seen.has(ref)) {
        const next = new Set(seen);
        next.add(ref);
        return resolveValue(scope[ref], scope, next);
      }
      if (fallback !== undefined) return resolveValue(fallback.trim(), scope, seen);
      return `var(${ref})`; // leave unresolved literal
    });
  }
  return v.trim();
}

/** Resolve every entry of a raw map against a resolution scope. */
function resolveMap(rawMap, scope) {
  /** @type {Record<string,string>} */
  const out = {};
  for (const key of Object.keys(rawMap)) {
    out[key] = resolveValue(rawMap[key], scope);
  }
  return out;
}

function main() {
  const files = readdirSync(CSS_DIR)
    .filter((f) => f.endsWith('.css'))
    .sort(); // deterministic order

  /** raw declarations per group, last-write-wins within a group. */
  const groups = {
    base: {},
    'theme:nocturne': {},
    'theme:daylight': {},
    'theme:midnight': {},
    'density:comfortable': {},
    'density:compact': {},
  };

  for (const file of files) {
    if (file === 'index.css') continue; // index only @imports + has reset rules (no tokens)
    const css = readFileSync(join(CSS_DIR, file), 'utf8');
    for (const rule of parseRules(css)) {
      for (const sel of rule.selectors) {
        const g = classify(sel);
        if (!g) continue;
        for (const d of rule.decls) groups[g][d.prop] = d.value;
      }
    }
  }

  // Base resolves against itself.
  const baseResolved = resolveMap(groups.base, groups.base);

  // A theme's own declared vars resolve against base ∪ theme-raw.
  const themeResolved = {};
  for (const t of THEME_NAMES) {
    const themeRaw = groups[`theme:${t}`];
    const scope = { ...groups.base, ...themeRaw };
    themeResolved[t] = resolveMap(themeRaw, scope);
  }

  // Density groups resolve against base ∪ that density (rem literals, no var refs today).
  const densityResolved = {};
  for (const d of DENSITY_NAMES) {
    const dRaw = groups[`density:${d}`];
    densityResolved[d] = resolveMap(dRaw, { ...groups.base, ...dRaw });
  }

  // Categorized base subsets — partition base vars by token family for the
  // `tokens.spacing/radius/shadow/motion/typography` convenience objects.
  const categoryFor = (key) => {
    if (key.startsWith('--space-')) return 'spacing';
    if (key.startsWith('--radius-')) return 'radius';
    if (
      key.startsWith('--shadow-') ||
      key.startsWith('--glow-')
    )
      return 'shadow';
    if (key.startsWith('--ease-') || key.startsWith('--dur-')) return 'motion';
    if (
      key.startsWith('--font-') ||
      key.startsWith('--fw-') ||
      key.startsWith('--text-') ||
      key.startsWith('--tracking-') ||
      key.startsWith('--leading-')
    )
      return 'typography';
    return null;
  };
  const spacing = {};
  const radius = {};
  const motion = {};
  const typography = {};
  for (const key of Object.keys(baseResolved)) {
    const cat = categoryFor(key);
    if (cat === 'spacing') spacing[key] = baseResolved[key];
    else if (cat === 'radius') radius[key] = baseResolved[key];
    else if (cat === 'motion') motion[key] = baseResolved[key];
    else if (cat === 'typography') typography[key] = baseResolved[key];
  }
  // Shadows live in theme blocks (not base) — surface them from Nocturne, the
  // :root default theme, so a non-CSS consumer gets the default ladder.
  const shadow = {};
  for (const key of Object.keys(themeResolved.nocturne)) {
    if (key.startsWith('--shadow-') || key.startsWith('--glow-')) shadow[key] = themeResolved.nocturne[key];
  }

  const tokens = {
    base: baseResolved,
    nocturne: themeResolved.nocturne,
    daylight: themeResolved.daylight,
    midnight: themeResolved.midnight,
    spacing,
    radius,
    shadow,
    motion,
    density: densityResolved,
    typography,
  };

  // Flat per-theme resolved map = base ∪ theme.
  const flatThemes = {};
  for (const t of THEME_NAMES) {
    flatThemes[t] = { ...baseResolved, ...themeResolved[t] };
  }

  const jsonOut = { tokens, themes: flatThemes };
  const json = JSON.stringify(jsonOut, null, 2) + '\n';
  writeFileSync(OUT_JSON, json);

  const ts =
    `/* AUTO-GENERATED by scripts/generate-tokens.mjs — DO NOT EDIT BY HAND.\n` +
    `   Regenerate with \`npm run generate\`. Source of truth: src/css/*.css. */\n\n` +
    `import type { ThemeName } from './themes';\n\n` +
    `export interface Tokens {\n` +
    `  base: Record<string, string>;\n` +
    `  nocturne: Record<string, string>;\n` +
    `  daylight: Record<string, string>;\n` +
    `  midnight: Record<string, string>;\n` +
    `  spacing: Record<string, string>;\n` +
    `  radius: Record<string, string>;\n` +
    `  shadow: Record<string, string>;\n` +
    `  motion: Record<string, string>;\n` +
    `  density: Record<'comfortable' | 'compact', Record<string, string>>;\n` +
    `  typography: Record<string, string>;\n` +
    `}\n\n` +
    `export const tokens: Tokens = ${JSON.stringify(tokens, null, 2)} as const;\n\n` +
    `/** Flat resolved custom-property map per theme (base vars ∪ theme overrides). */\n` +
    `const FLAT_THEMES: Record<ThemeName, Record<string, string>> = ${JSON.stringify(flatThemes, null, 2)} as const;\n\n` +
    `/**\n` +
    ` * Flat resolved token map for a theme — concrete values (var() refs resolved),\n` +
    ` * for React Native / Roku / any non-CSS consumer. clamp()/rgba() strings are\n` +
    ` * preserved as-is.\n` +
    ` */\n` +
    `export function resolveTheme(name: ThemeName): Record<string, string> {\n` +
    `  return { ...FLAT_THEMES[name] };\n` +
    `}\n`;
  writeFileSync(OUT_TS, ts);

   
  console.log(
    `generated ${OUT_TS} and ${OUT_JSON} — base:${Object.keys(baseResolved).length} ` +
      `nocturne:${Object.keys(themeResolved.nocturne).length} ` +
      `daylight:${Object.keys(themeResolved.daylight).length} ` +
      `midnight:${Object.keys(themeResolved.midnight).length}`,
  );
}

main();
