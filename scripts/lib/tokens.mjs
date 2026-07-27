/**
 * tokens.mjs — the pure token-model half of scripts/generate-tokens.mjs:
 * CSS parsing, `var()` resolution, token-family partitioning, the vacuity
 * assertions, and the two output renderers.
 *
 * This module is side-effect free BY CONSTRUCTION: it reads no files, writes no
 * files and lists no directories. Every input arrives as a string. That is the
 * whole point of the split, and it is the same split PR #11 applied to
 * scripts/add-copyright.mjs → scripts/lib/copyright.mjs.
 *
 * Why the split exists (the defect it removes): these functions used to live in
 * scripts/generate-tokens.mjs next to a `main()` that writes files, so that
 * `main()` had to be fenced off behind
 *   if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
 * to keep the unit test's import from rewriting the repo. That guard is a
 * silent-failure trap: `pathToFileURL()` does NOT resolve symlinks while
 * `import.meta.url` IS the resolved realpath. Reach the script through a
 * symlinked file, a symlinked directory component, or a package `bin` shim and
 * the two hrefs differ, the guard is false, and the whole run becomes a
 * zero-output, exit-0 no-op that looks exactly like success.
 *
 * That was worse than an ordinary bug because .github/workflows/ci.yml runs
 * `npm run generate` and then `git diff --exit-code` on the committed
 * artifacts. A generator that produces nothing makes that gate compare the
 * committed artifact against ITSELF, so the gate passed unconditionally — a
 * gate that could not fail. It is how the 9ec4298 token corruption stayed
 * green. With the pure code in its own module the CLI needs no guard at all,
 * so there is no guard left to be wrong; `assertNonVacuous()` below then makes
 * a vacuous run a loud non-zero exit rather than a quiet success.
 *
 * Selector model (unchanged):
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
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

const THEME_NAMES = ['nocturne', 'daylight', 'midnight'];
const DENSITY_NAMES = ['comfortable', 'compact'];

/**
 * Stylesheets that carry no tokens and are skipped by `buildTokens`. index.css
 * only `@import`s its siblings and holds reset rules.
 */
const NON_TOKEN_CSS = new Set(['index.css']);

/**
 * Which token family each source stylesheet contributes to, for the
 * `tokens.spacing/radius/shadow/motion/typography` convenience objects. `null`
 * = contributes to no family (its vars live only in `tokens.base` / the theme
 * maps).
 *
 * The family is derived from the var's SOURCE FILE, not from a key-prefix
 * guess. That fixes B1: colors.css declares `--text`, `--text-muted`,
 * `--text-subtle`, `--text-faint`, `--text-on-accent`, which a prefix scheme
 * mis-read as `typography` because of the `--text-` prefix. It also closes CQ2:
 * a new `*.css` token family maps cleanly with one lookup entry and never
 * silently lands in the wrong (or no) family.
 */
const FILE_FAMILY = {
  'spacing.css': 'spacing',
  'radius.css': 'radius',
  'shadow.css': 'shadow',
  'motion.css': 'motion',
  'typography.css': 'typography',
  'colors.css': null,
  'density.css': null, // density is emitted separately as a per-variant map
};

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
 * Guard against a `var()` whose fallback nests parentheses deeper than the
 * single-level `varRe` below can capture. `varRe`'s fallback pattern
 * (`[^()]*(?:\([^()]*\)[^()]*)*`) matches at most ONE level of nested parens
 * inside the fallback; a two-level nest such as
 * `var(--x, clamp(1rem, calc(2px + 1vw), 3rem))` would be mis-captured and
 * could silently resolve to the wrong substring. No current token hits this
 * (B4 is a latent defect), so rather than silently mis-resolve we fail closed:
 * scan each `var(` occurrence with a balanced-paren walker and THROW if its
 * fallback contains a parenthesis nested more than one level deep. This keeps
 * generation deterministic and a no-op on the real CSS while making any future
 * over-nested fallback a loud, clear generator error instead of a silent bug.
 *
 * @param {string} value the raw declaration value being resolved
 */
function assertVarFallbackDepth(value) {
  // Walk to each `var(` token, then scan its parenthesised body, tracking the
  // nesting depth of parens that appear AFTER the fallback comma (the part the
  // single-level regex is responsible for). Depth 1 = the fallback's own
  // function call (e.g. `clamp(...)`) — supported. Depth ≥ 2 = a nested call
  // inside that (e.g. `calc(...)` inside `clamp(...)`) — unsupported by varRe.
  for (let i = value.indexOf('var('); i !== -1; i = value.indexOf('var(', i + 1)) {
    let depth = 0; // paren depth relative to this var('s opening paren
    let sawComma = false; // have we passed the fallback comma at depth 1 yet?
    let fallbackDepth = 0; // paren depth measured from the start of the fallback
    for (let j = i + 3; j < value.length; j++) {
      const ch = value[j];
      if (ch === '(') {
        depth++;
        if (sawComma) {
          fallbackDepth++;
          if (fallbackDepth > 1) {
            throw new Error(
              `generate-tokens: var() fallback nests parentheses deeper than the ` +
                `single-level resolver supports (would silently mis-resolve). ` +
                `Value: ${value.trim()}`,
            );
          }
        }
      } else if (ch === ')') {
        if (sawComma && fallbackDepth > 0) fallbackDepth--;
        depth--;
        if (depth === 0) break; // closed this var()
      } else if (ch === ',' && depth === 1) {
        sawComma = true; // first comma at the var()'s own level = fallback start
      }
    }
  }
}

/**
 * Resolve `var(--ref[, fallback])` chains within a single scope map. Iterative
 * with a fixpoint; unresolved refs fall through to their fallback or are left
 * as a literal var() string (e.g. a ref to a property that lives in another
 * scope). Deterministic.
 *
 * `varRe` captures at most one level of nested parens inside a fallback; a
 * deeper nest is rejected up-front by `assertVarFallbackDepth` so it can never
 * silently mis-resolve (B4).
 */
function resolveValue(value, scope, seen = new Set()) {
  assertVarFallbackDepth(value);
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

/**
 * Build the whole token model from already-read stylesheets. Pure: takes
 * `[{ name, css }]` (name = the bare filename, used for family attribution) and
 * returns `{ tokens, themes }` with the exact key insertion order the emitted
 * artifacts depend on.
 *
 * @param {Array<{name: string, css: string}>} files
 */
function buildTokens(files) {
  /** raw declarations per group, last-write-wins within a group. */
  const groups = {
    base: {},
    'theme:nocturne': {},
    'theme:daylight': {},
    'theme:midnight': {},
    'density:comfortable': {},
    'density:compact': {},
  };

  /**
   * Source file for each `base` (`:root`) declaration, last-write-wins in lockstep
   * with `groups.base` above. Used to categorize base vars by their originating
   * file (e.g. typography.css → typography) instead of by guessing from the key
   * prefix — see `categoryFor` below. This is what keeps colors.css keys such as
   * `--text-muted` out of `tokens.typography` (B1) and makes adding a new token
   * family a one-file affair (CQ2).
   */
  const baseSource = {};

  // Sort by name so the walk order is deterministic regardless of the order the
  // caller listed the directory in.
  const ordered = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const file of ordered) {
    if (NON_TOKEN_CSS.has(file.name)) continue; // index only @imports + has reset rules (no tokens)
    for (const rule of parseRules(file.css)) {
      for (const sel of rule.selectors) {
        const g = classify(sel);
        if (!g) continue;
        for (const d of rule.decls) {
          groups[g][d.prop] = d.value;
          if (g === 'base') baseSource[d.prop] = file.name;
        }
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
  // `tokens.spacing/radius/shadow/motion/typography` convenience objects. The
  // family comes from FILE_FAMILY (source file), never from a key prefix; an
  // unknown source file maps to null (ignored) rather than being guessed into a
  // family, so a new file is a deliberate FILE_FAMILY add.
  const categoryFor = (key) => {
    const file = baseSource[key];
    if (file === undefined) return null;
    return Object.prototype.hasOwnProperty.call(FILE_FAMILY, file) ? FILE_FAMILY[file] : null;
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
  // Shadows live in theme blocks (not base): shadow.css declares distinct
  // ladders per theme (daylight is brown-tinted + softer, midnight is heavier).
  // Emit `tokens.shadow` as a PER-THEME map (mirroring `tokens.density`'s shape)
  // so a non-CSS consumer (React Native / Roku) gets the correct ladder for the
  // active theme instead of always the Nocturne dark ladder (CQ3). Each theme's
  // own resolved `--shadow-*` / `--glow-*` keys are surfaced.
  const shadow = {};
  for (const t of THEME_NAMES) {
    shadow[t] = {};
    for (const key of Object.keys(themeResolved[t])) {
      if (key.startsWith('--shadow-') || key.startsWith('--glow-')) {
        shadow[t][key] = themeResolved[t][key];
      }
    }
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
  const themes = {};
  for (const t of THEME_NAMES) {
    themes[t] = { ...baseResolved, ...themeResolved[t] };
  }

  return { tokens, themes };
}

/**
 * Throw unless the built model actually contains tokens.
 *
 * This is the second half of the silent-no-op fix. Removing the main-guard
 * makes `main()` always run; this makes a run that produced NOTHING a loud
 * non-zero exit instead of a quiet success. Without it, `npm run generate` can
 * still write two structurally valid but empty artifacts (all-`{}` maps) and
 * report success — and CI's `git diff --exit-code` gate would then be comparing
 * two files that no longer describe the CSS at all. Fail closed, exactly as
 * `assertVarFallbackDepth` does for an unresolvable value.
 *
 * @param {{tokens: Record<string, unknown>, themes: Record<string, unknown>}} built
 */
function assertNonVacuous(built) {
  const { tokens } = built;
  const count = (o) => Object.keys(o ?? {}).length;

  if (count(tokens.base) === 0) {
    throw new Error(
      'generate-tokens: parsed 0 `:root` custom properties — refusing to write an empty ' +
        'token artifact and report success. Check that src/css/*.css still declares `:root { --… }`.',
    );
  }
  for (const t of THEME_NAMES) {
    if (count(tokens[t]) === 0) {
      throw new Error(
        `generate-tokens: theme '${t}' resolved to 0 tokens — refusing to write an empty ` +
          `theme map and report success. Check that src/css/*.css still declares ` +
          `[data-theme='${t}'] { --… }.`,
      );
    }
  }
  for (const d of DENSITY_NAMES) {
    if (count(tokens.density?.[d]) === 0) {
      throw new Error(
        `generate-tokens: density '${d}' resolved to 0 tokens — refusing to write an empty ` +
          `density map and report success. Check that src/css/density.css still declares ` +
          `[data-density='${d}'] { --… }.`,
      );
    }
  }
}

/** Render src/tokens.generated.json. Pure. */
function renderJson({ tokens, themes }) {
  return JSON.stringify({ tokens, themes }, null, 2) + '\n';
}

/** Render src/tokens.generated.ts. Pure. */
function renderTs({ tokens, themes }) {
  return (
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
    `  shadow: Record<ThemeName, Record<string, string>>;\n` +
    `  motion: Record<string, string>;\n` +
    `  density: Record<'comfortable' | 'compact', Record<string, string>>;\n` +
    `  typography: Record<string, string>;\n` +
    `}\n\n` +
    `export const tokens: Tokens = ${JSON.stringify(tokens, null, 2)} as const;\n\n` +
    `/** Flat resolved custom-property map per theme (base vars ∪ theme overrides). */\n` +
    `const FLAT_THEMES: Record<ThemeName, Record<string, string>> = ${JSON.stringify(themes, null, 2)} as const;\n\n` +
    `/**\n` +
    ` * Flat resolved token map for a theme — concrete values (var() refs resolved),\n` +
    ` * for React Native / Roku / any non-CSS consumer. clamp()/rgba() strings are\n` +
    ` * preserved as-is.\n` +
    ` */\n` +
    `export function resolveTheme(name: ThemeName): Record<string, string> {\n` +
    `  return { ...FLAT_THEMES[name] };\n` +
    `}\n`
  );
}

export {
  THEME_NAMES,
  DENSITY_NAMES,
  NON_TOKEN_CSS,
  FILE_FAMILY,
  stripComments,
  parseRules,
  classify,
  assertVarFallbackDepth,
  resolveValue,
  resolveMap,
  buildTokens,
  assertNonVacuous,
  renderJson,
  renderTs,
};
