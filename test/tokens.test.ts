/**
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  tokens,
  resolveTheme,
  THEMES,
  DENSITIES,
  DEFAULT_THEME,
  DEFAULT_DENSITY,
  DATA_THEME,
  DATA_DENSITY,
  DATA_REDUCED_MOTION,
  applyTokenAttributes,
  type TokenTarget,
  ACCENT_KEYS,
  ACCENT_INK_DARK,
  ACCENT_INK_LIGHT,
  deriveAccentVars,
  parseHex,
  toHex,
  lighten,
  darken,
  rgba,
  luminance,
} from '../src/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * LW-073/LW-074: colors.css is the visual SSOT. These tests read it directly
 * so the JS accent contract and the contrast claims cannot drift from the CSS
 * again — the bug classes this wave cures are exactly "CSS declares a role the
 * roster forgot" and "a comment asserts a ratio nothing enforces".
 */
const COLORS_CSS = readFileSync(join(__dirname, '..', 'src', 'css', 'colors.css'), 'utf8');
const COLORS_CSS_STRIPPED = COLORS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Accent custom-property names colors.css DECLARES (line-start declarations
 *  in comment-stripped CSS; legacy `var(--accent…)` alias bodies never match,
 *  and neither do the cased `--color-accent…` aliases). */
function cssAccentNames(): string[] {
  return [
    ...new Set([...COLORS_CSS_STRIPPED.matchAll(/^\s*(--accent[a-z-]*)\s*:/gm)].map((m) => m[1])),
  ].sort();
}

/** WCAG contrast ratio between two hex colors: (Lmax + 0.05) / (Lmin + 0.05). */
function contrastRatio(hexA: string, hexB: string): number {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) throw new Error(`unparseable hex in contrast pair: ${hexA} / ${hexB}`);
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** A minimal in-memory TokenTarget for asserting applyTokenAttributes. */
function makeTarget(): TokenTarget & {
  attrs: Record<string, string>;
  props: Record<string, string>;
} {
  const attrs: Record<string, string> = {};
  const props: Record<string, string> = {};
  return {
    attrs,
    props,
    setAttribute: (n, v) => {
      attrs[n] = v;
    },
    removeAttribute: (n) => {
      delete attrs[n];
    },
    style: {
      setProperty: (p, v) => {
        props[p] = v;
      },
      removeProperty: (p) => {
        delete props[p];
      },
    },
  };
}

describe('themes metadata', () => {
  it('has exactly 3 themes in canonical order', () => {
    expect(THEMES).toEqual(['nocturne', 'daylight', 'midnight']);
    expect(THEMES).toHaveLength(3);
  });

  it('has 2 densities and the right defaults', () => {
    expect(DENSITIES).toEqual(['comfortable', 'compact']);
    expect(DEFAULT_THEME).toBe('nocturne');
    expect(DEFAULT_DENSITY).toBe('comfortable');
  });

  it('exposes the DOM attribute contract', () => {
    expect(DATA_THEME).toBe('data-theme');
    expect(DATA_DENSITY).toBe('data-density');
    expect(DATA_REDUCED_MOTION).toBe('data-reduced-motion');
  });
});

describe('resolveTheme', () => {
  it('leaves no unresolved var() anywhere in tokens.base', () => {
    const base = tokens.base;
    const keys = Object.keys(base);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(base[key]).not.toContain('var(');
    }
  });

  for (const t of THEMES) {
    it(`resolves --bg/--accent/--text to concrete (non-var) values for ${t}`, () => {
      const m = resolveTheme(t);
      for (const key of ['--bg', '--accent', '--text']) {
        expect(m[key]).toBeTruthy();
        expect(m[key]).not.toContain('var(');
      }
    });

    it(`leaves no unresolved var() in any resolved value for ${t}`, () => {
      const m = resolveTheme(t);
      const keys = Object.keys(m);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(m[key]).not.toContain('var(');
      }
    });
  }

  it('nocturne --bg/--accent/--text are the expected concrete values', () => {
    const m = resolveTheme('nocturne');
    expect(m['--bg']).toBe('#0b0a08');
    expect(m['--accent']).toBe('#f5a524'); // resolved from var(--amber-500)
    expect(m['--text']).toBe('#f3ece1');
    expect(m['--accent-soft']).toBe('rgba(245, 165, 36, 0.14)'); // rgba preserved
    expect(m['--color-bg']).toBe('#0b0a08'); // legacy alias resolved
  });

  it('daylight differs from nocturne where expected', () => {
    expect(resolveTheme('daylight')['--bg']).toBe('#f7f1e6');
    expect(resolveTheme('midnight')['--bg']).toBe('#000000');
  });

  it('includes resolved shadow ladder from the theme block', () => {
    expect(resolveTheme('nocturne')['--shadow-2']).toBe('0 4px 14px rgba(0, 0, 0, 0.48)');
  });

  it('returns a fresh copy each call (no shared mutation)', () => {
    const a = resolveTheme('nocturne');
    a['--bg'] = 'MUTATED';
    expect(resolveTheme('nocturne')['--bg']).toBe('#0b0a08');
  });
});

describe('tokens object', () => {
  it('preserves clamp() typography strings verbatim', () => {
    expect(tokens.typography['--text-xl']).toBe('clamp(1.4rem, 1.1rem + 1.2vw, 1.75rem)');
  });

  // B1 regression guard: color tokens declared in colors.css (`--text-muted`,
  // `--text-subtle`, `--text-faint`, `--text-on-accent`) must NOT leak into
  // tokens.typography just because they share the `--text-` prefix.
  it('tokens.typography contains no hex / color values', () => {
    const hexRe = /#[0-9a-fA-F]{3,8}\b/;
    for (const [key, value] of Object.entries(tokens.typography)) {
      expect(value, `${key} should not be a hex color`).not.toMatch(hexRe);
      expect(value.startsWith('rgb'), `${key} should not be rgb/rgba`).toBe(false);
      expect(value.startsWith('hsl'), `${key} should not be hsl/hsla`).toBe(false);
    }
    // the specific leaked keys are gone
    expect(tokens.typography['--text-muted']).toBeUndefined();
    expect(tokens.typography['--text-subtle']).toBeUndefined();
    expect(tokens.typography['--text-faint']).toBeUndefined();
    expect(tokens.typography['--text-on-accent']).toBeUndefined();
  });

  it('tokens.typography still contains the real type scale', () => {
    expect(tokens.typography['--text-xl']).toBe('clamp(1.4rem, 1.1rem + 1.2vw, 1.75rem)');
    expect(tokens.typography['--font-sans']).toContain('Hanken Grotesk');
    expect(tokens.typography['--font-bold']).toBe('700');
    expect(tokens.typography['--tracking-caps']).toBe('0.12em');
    expect(tokens.typography['--leading-normal']).toBe('1.55');
  });

  // The color names were only RECATEGORIZED, not dropped: they remain reachable
  // through the base / theme maps via resolveTheme (the CSS keys are unchanged,
  // so phlix-ui and other consumers still resolve them).
  it('keeps the recategorized color names reachable via resolveTheme', () => {
    expect(resolveTheme('nocturne')['--text-muted']).toBe('#b8ab98');
    expect(resolveTheme('nocturne')['--text-subtle']).toBe('#918370');
    expect(resolveTheme('nocturne')['--text-faint']).toBe('#544a3f');
    expect(resolveTheme('nocturne')['--text-on-accent']).toBe('#2a1804');
    // also present on tokens.base (theme-invariant declarations resolved against base)
    expect(tokens.base['--text-muted']).toBe('#b8ab98');
  });

  it('has spacing/radius/motion families', () => {
    expect(tokens.spacing['--space-4']).toBe('1rem');
    expect(tokens.radius['--radius-full']).toBe('9999px');
    expect(tokens.motion['--dur-base']).toBe('200ms');
  });
  it('has both density variants', () => {
    expect(tokens.density.comfortable['--control-h']).toBe('2.5rem');
    expect(tokens.density.compact['--control-h']).toBe('2.125rem');
  });
  it('exposes the three theme objects', () => {
    expect(tokens.nocturne['--bg']).toBe('#0b0a08');
    expect(tokens.daylight['--bg']).toBe('#f7f1e6');
    expect(tokens.midnight['--bg']).toBe('#000000');
  });

  // CQ3: tokens.shadow is now a PER-THEME map (Record<ThemeName, …>) mirroring
  // tokens.density, instead of only the Nocturne ladder. A non-CSS consumer
  // (React Native / Roku) gets the right shadow ladder for the active theme.
  it('exposes a per-theme shadow map (CQ3 — theme-aware)', () => {
    // shape: one entry per theme, each a string→string map
    expect(Object.keys(tokens.shadow).sort()).toEqual(
      ['daylight', 'midnight', 'nocturne'].sort(),
    );
    // nocturne ladder is the prior default and unchanged
    expect(tokens.shadow.nocturne['--shadow-2']).toBe('0 4px 14px rgba(0, 0, 0, 0.48)');
    // daylight is a distinct (brown-tinted, softer) ladder → proves theme-awareness
    expect(tokens.shadow.daylight['--shadow-2']).not.toBe(tokens.shadow.nocturne['--shadow-2']);
    expect(tokens.shadow.daylight['--shadow-2']).toBe('0 4px 14px rgba(74, 55, 20, 0.12)');
    expect(tokens.shadow.midnight['--shadow-2']).toBe('0 4px 14px rgba(0, 0, 0, 0.70)');
    // glow + legacy aliases are surfaced per theme too
    expect(tokens.shadow.nocturne['--glow-amber']).toContain('rgba(245, 165, 36');
    expect(tokens.shadow.nocturne['--shadow-md']).toBe(tokens.shadow.nocturne['--shadow-2']);
  });
});

describe('generated json round-trips', () => {
  it('matches the tokens/themes shape on disk', () => {
    const jsonPath = join(__dirname, '..', 'src', 'tokens.generated.json');
    const data = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
      tokens: typeof tokens;
      themes: Record<string, Record<string, string>>;
    };
    expect(data.tokens.nocturne['--bg']).toBe(tokens.nocturne['--bg']);
    expect(data.themes.nocturne['--accent']).toBe(resolveTheme('nocturne')['--accent']);
    expect(Object.keys(data.themes)).toEqual(['nocturne', 'daylight', 'midnight']);
  });
});

// ---------------------------------------------------------------------------
// Font-family token case guard.
//
// INCIDENT: 7a8cb32 ("fix: codacy issues and findings") lower-cased `Georgia`
// to `georgia` in src/css/typography.css. It was the ONLY src/ change in that
// commit; the rest was .caliber/ + .claude/ files. The value then rode into
// src/tokens.generated.{ts,json} and all of dist/ under 2f2b703, whose subject
// is "提升测试覆盖率" ("improve test coverage") — so the token change was
// invisible in the log. Nothing in the CHANGELOG mentioned it.
//
// WHY IT HAPPENED: a `value-keyword-case` style rule (Codacy runs stylelint
// server-side; there is no stylelint in this repo's own toolchain, so
// `npm run lint` — eslint — cannot see CSS at all) reports an unquoted family
// name as a value keyword that "should be lowercase". Inside a CUSTOM property
// the rule has no way to know `--font-display` holds a font stack, so its
// font-family exemption does not apply. Note it hit only `Georgia` and left
// `Menlo` / `SFMono-Regular` alone, so it was applied by hand, not wholesale.
//
// WHY IT MATTERS: harmless in CSS — family-name matching is ASCII
// case-insensitive (measured in Chrome: 'DejaVu Serif', 'dejavu serif',
// 'DEJAVU SERIF' and unquoted `dejavu serif` all render identically, while a
// bogus family renders at a different width, so that check was not vacuous).
// But this file is the source for src/tokens.generated.json, which the non-CSS
// clients (React Native / Roku) read, and a font name matched exactly there
// would miss. An unreviewed value change in a published token is the defect
// regardless of whether this particular one rendered.
//
// This suite pins the exact strings so `--fix`-style casing damage reds CI.
// Assert against the DISK artifact, not just the imported object, so a stale
// generated file cannot hide the drift.
// ---------------------------------------------------------------------------
describe('font family tokens', () => {
  const EXPECTED: Record<string, string> = {
    '--font-display': "'Fraunces', 'Fraunces Fallback', Georgia, 'Times New Roman', serif",
    '--font-sans':
      "'Hanken Grotesk', 'Hanken Grotesk Fallback', system-ui, -apple-system, 'Segoe UI', sans-serif",
    '--font-mono':
      "'JetBrains Mono', 'JetBrains Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace",
  };

  /** Family names that MUST keep their capitals. Lower-casing any is the bug. */
  const CASED_FAMILIES = ['Fraunces', 'Fraunces Fallback', 'Georgia', 'Times New Roman',
    'Hanken Grotesk', 'Segoe UI', 'JetBrains Mono', 'SFMono-Regular', 'Menlo'];

  it('typography.css declares the family stacks verbatim, capitals intact', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'css', 'typography.css'), 'utf8');
    // Strip comments first: the explanatory block above these declarations
    // names every family, so an uncommented scan would match its own docs.
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // Non-vacuity: a phrase that exists ONLY in that comment must be gone, so
    // we know the strip ran and the matches below come from real declarations.
    expect(code, 'comment strip did not run').not.toContain('value-keyword-case');
    const norm = code.replace(/[ \t]+/g, ' ');
    for (const [key, value] of Object.entries(EXPECTED)) {
      expect(norm, `${key} declaration in typography.css`).toContain(`${key}: ${value};`);
    }
  });

  it('the exported tokens carry the exact family strings', () => {
    for (const [key, value] of Object.entries(EXPECTED)) {
      expect(tokens.typography[key], `tokens.typography[${key}]`).toBe(value);
      for (const t of THEMES) {
        expect(resolveTheme(t)[key], `resolveTheme('${t}')[${key}]`).toBe(value);
      }
    }
  });

  it('the committed JSON artifact carries the exact family strings', () => {
    const jsonPath = join(__dirname, '..', 'src', 'tokens.generated.json');
    const raw = readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(raw) as {
      tokens: { typography: Record<string, string> };
      themes: Record<string, Record<string, string>>;
    };
    for (const [key, value] of Object.entries(EXPECTED)) {
      expect(data.tokens.typography[key], `json tokens.typography[${key}]`).toBe(value);
      for (const t of THEMES) {
        expect(data.themes[t][key], `json themes.${t}[${key}]`).toBe(value);
      }
    }
    // No lower-cased spelling of a cased family may appear ANYWHERE in the
    // artifact — this is what actually catches a `--fix` sweep.
    for (const family of CASED_FAMILIES) {
      expect(raw, `lower-cased "${family}" leaked into tokens.generated.json`)
        .not.toContain(family.toLowerCase());
      expect(raw, `"${family}" missing from tokens.generated.json`).toContain(family);
    }
  });
});

describe('deriveAccentVars / accent helpers', () => {
  it('returns exactly the ACCENT_KEYS', () => {
    const vars = deriveAccentVars('#f5a524');
    expect(vars).not.toBeNull();
    expect(Object.keys(vars as Record<string, string>).sort()).toEqual([...ACCENT_KEYS].sort());
  });

  it('derives concrete hex + rgba roles from a hex', () => {
    const vars = deriveAccentVars('#f5a524') as Record<string, string>;
    expect(vars['--accent']).toBe('#f5a524');
    expect(vars['--accent-soft']).toBe('rgba(245, 165, 36, 0.14)');
    expect(vars['--accent-ring']).toBe('rgba(245, 165, 36, 0.55)');
    // light accent → dark ink contrast (canonical ACCENT_INK_DARK)
    expect(vars['--accent-contrast']).toBe('#2a1804');
    expect(vars['--accent-contrast']).toBe(ACCENT_INK_DARK);
  });

  it('picks light ink for a dark accent', () => {
    const vars = deriveAccentVars('#101010') as Record<string, string>;
    expect(vars['--accent-contrast']).toBe('#fff8ec');
    expect(vars['--accent-contrast']).toBe(ACCENT_INK_LIGHT);
  });

  // B2 single-source-of-truth regression guard: the runtime accent-picker path
  // (deriveAccentVars) and the static CSS `--accent-contrast` must agree for the
  // default amber. If colors.css and accent.ts ever drift again, this fails.
  it('agrees with the CSS --accent-contrast for the default amber (single source of truth)', () => {
    const vars = deriveAccentVars('#f5a524') as Record<string, string>;
    expect(vars['--accent-contrast']).toBe(resolveTheme('nocturne')['--accent-contrast']);
    expect(vars['--accent-contrast']).toBe(ACCENT_INK_DARK);
  });

  // LW-073: --accent-text was declared by colors.css in every theme block but
  // missing from ACCENT_KEYS and deriveAccentVars, so an accent override
  // painted the fill roles and left the text role on the theme ramp — broken
  // accent/text pairing on the two-tone theme (daylight), plus a stale roster
  // for consumers clearing an override. The roster is now pinned to colors.css
  // itself: a new accent role cannot hide from the JS side again.
  it('ACCENT_KEYS equals the accent names colors.css declares', () => {
    expect(cssAccentNames()).toEqual([...ACCENT_KEYS].sort());
  });

  it('derives --accent-text as the accent itself for the dark scheme', () => {
    const vars = deriveAccentVars('#f5a524') as Record<string, string>;
    // The colors.css dark blocks declare `--accent-text: var(--amber-500)` —
    // the accent hue itself, which measures AA on their bg/surface.
    expect(vars['--accent-text']).toBe('#f5a524');
    expect(vars['--accent-text']).toBe(resolveTheme('nocturne')['--accent-text']);
    expect(vars['--accent-text']).toBe(resolveTheme('midnight')['--accent-text']);
  });

  it('derives --accent-text darkened-to-AA for the light scheme', () => {
    const daylight = resolveTheme('daylight');
    const surfaces = ['--bg', '--surface', '--surface-2', '--surface-3'];
    // Amber-as-text measures 1.82–2.01:1 on the light surfaces; the colors.css
    // daylight block answers with a darkened ramp step (`var(--amber-800)`).
    // The derivation is the continuous form of that law — same relationship
    // hover/active already have to the ramp: darken the hue until AA clears
    // against --surface-3, the darkest shipped light background (a dark
    // foreground's ratio only rises as the background lightens, so clearing
    // there clears bg/surface/surface-2 and white too).
    const amber = deriveAccentVars('#f5a524', 'light') as Record<string, string>;
    for (const s of surfaces) {
      expect(
        contrastRatio(amber['--accent-text'], daylight[s]),
        `derived amber on ${s}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(amber['--accent']).toBe('#f5a524'); // the fill roles stay scheme-independent
    // Hues that already clear AA are returned byte-identical (no-op darkening):
    expect((deriveAccentVars('#924d10', 'light') as Record<string, string>)['--accent-text']).toBe('#924d10');
    expect((deriveAccentVars('#000000', 'light') as Record<string, string>)['--accent-text']).toBe('#000000');
    // Pale, mid and off-white hues all clear after the bounded walk:
    for (const h of ['#ffffff', '#ffedcc', '#ef5e57', '#c7d6ff', '#e8dcc6', '#2a1804']) {
      const d = deriveAccentVars(h, 'light') as Record<string, string>;
      for (const s of surfaces) {
        expect(
          contrastRatio(d['--accent-text'], daylight[s]),
          `${h} derived on ${s}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the one-argument call shape on the dark-scheme default', () => {
    // Existing consumers call deriveAccentVars(hex) — the default must equal
    // the explicit dark branch, and the returned keys must be the roster.
    expect(deriveAccentVars('#3366ff')).toEqual(deriveAccentVars('#3366ff', 'dark'));
    expect(Object.keys(deriveAccentVars('#3366ff') as Record<string, string>)).toHaveLength(
      ACCENT_KEYS.length,
    );
  });

  it('THEME_SCHEMES matches the color-scheme each colors.css block declares', async () => {
    // Dynamic read so the failure names the missing export — a static import
    // of a not-yet-existing binding would break the file's whole link step.
    const mod = (await import('../src/index')) as { THEME_SCHEMES?: Record<string, string> };
    expect(mod.THEME_SCHEMES, 'THEME_SCHEMES is not exported').toBeDefined();
    const declared: Record<string, string> = {};
    for (const m of COLORS_CSS_STRIPPED.matchAll(/\[data-theme='(\w+)'\][^{]*\{([^}]*)\}/g)) {
      const cs = /color-scheme:\s*(\w+)/.exec(m[2]);
      if (cs) declared[m[1]] = cs[1];
    }
    expect(Object.keys(declared).sort()).toEqual([...THEMES].sort());
    expect({ ...mod.THEME_SCHEMES }).toEqual(declared);
  });

  it('returns null for unparseable input', () => {
    expect(deriveAccentVars('nope')).toBeNull();
    expect(deriveAccentVars('#12')).toBeNull();
  });

  it('parseHex handles 3- and 6-digit, with/without #', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHex('#f5a524')).toEqual({ r: 245, g: 165, b: 36 });
    expect(parseHex('zzzzzz')).toBeNull();
  });

  it('toHex round-trips and clamps', () => {
    expect(toHex({ r: 245, g: 165, b: 36 })).toBe('#f5a524');
    expect(toHex({ r: 300, g: -5, b: 0 })).toBe('#ff0000');
  });

  it('lighten/darken move toward white/black', () => {
    expect(toHex(lighten({ r: 0, g: 0, b: 0 }, 1))).toBe('#ffffff');
    expect(toHex(darken({ r: 255, g: 255, b: 255 }, 1))).toBe('#000000');
  });

  it('rgba formats with clamped channels', () => {
    expect(rgba({ r: 245, g: 165, b: 36 }, 0.5)).toBe('rgba(245, 165, 36, 0.5)');
  });

  it('luminance ranks white > black', () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeGreaterThan(luminance({ r: 0, g: 0, b: 0 }));
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });
});

describe('applyTokenAttributes', () => {
  afterEach(() => {
    // restore any global document stub
    delete (globalThis as { document?: unknown }).document;
  });

  it('sets data-theme + data-density on the target', () => {
    const t = makeTarget();
    applyTokenAttributes(t, { theme: 'midnight', density: 'compact' });
    expect(t.attrs[DATA_THEME]).toBe('midnight');
    expect(t.attrs[DATA_DENSITY]).toBe('compact');
  });

  it('sets data-reduced-motion when true, removes when false', () => {
    const t = makeTarget();
    applyTokenAttributes(t, { theme: 'nocturne', density: 'comfortable', reducedMotion: true });
    expect(t.attrs[DATA_REDUCED_MOTION]).toBe('true');
    applyTokenAttributes(t, { theme: 'nocturne', density: 'comfortable', reducedMotion: false });
    expect(t.attrs[DATA_REDUCED_MOTION]).toBeUndefined();
  });

  it('applies an accent override then clears it when accent is null', () => {
    const t = makeTarget();
    applyTokenAttributes(t, { theme: 'nocturne', density: 'comfortable', accent: '#3366ff' });
    expect(t.props['--accent']).toBe('#3366ff');
    applyTokenAttributes(t, { theme: 'nocturne', density: 'comfortable', accent: null });
    expect(t.props['--accent']).toBeUndefined();
    // LW-073 widened the clearing roster to ACCENT_KEYS — --accent-text must
    // never survive an override teardown as a stale inline property.
    expect(t.props['--accent-text']).toBeUndefined();
  });

  it('derives a scheme-correct --accent-text when overriding the accent (LW-073)', () => {
    // The two-tone gap this cures: on daylight the text role lives a full ramp
    // below the fill, so the override must derive it for the target theme's
    // scheme instead of leaving the theme's amber-800 under a foreign fill.
    const t = makeTarget();
    applyTokenAttributes(t, { theme: 'daylight', density: 'comfortable', accent: '#3366ff' });
    expect(t.props['--accent']).toBe('#3366ff');
    expect(typeof t.props['--accent-text'], 'override must paint the text role too').toBe('string');
    expect(t.props['--accent-text']).toBe(
      (deriveAccentVars('#3366ff', 'light') as Record<string, string>)['--accent-text'],
    );
    expect(t.props['--accent-text']).not.toBe('#3366ff');

    const d = makeTarget();
    applyTokenAttributes(d, { theme: 'nocturne', density: 'comfortable', accent: '#3366ff' });
    expect(d.props['--accent-text']).toBe('#3366ff'); // dark themes use the hue itself
  });

  it('clears accent vars when the hex is unparseable', () => {
    const t = makeTarget();
    t.props['--accent'] = 'stale';
    applyTokenAttributes(t, { theme: 'nocturne', density: 'comfortable', accent: 'garbage' });
    expect(t.props['--accent']).toBeUndefined();
  });

  it('is a no-op when no element and no document are available', () => {
    expect(() => applyTokenAttributes(null, { theme: 'nocturne', density: 'comfortable' })).not.toThrow();
  });

  it('falls back to document.documentElement when no element is passed', () => {
    const t = makeTarget();
    (globalThis as { document?: unknown }).document = { documentElement: t };
    applyTokenAttributes(undefined, { theme: 'daylight', density: 'comfortable' });
    expect(t.attrs[DATA_THEME]).toBe('daylight');
  });
});

// ---------------------------------------------------------------------------
// Step PARITY — light/dark theme parity CI guard.
// Every theme map (tokens.nocturne / daylight / midnight) must declare the SAME
// key set. This hardens against future B1-class drift (a token added to one
// theme block but not the others). There are currently NO intentional
// per-theme-only keys, so no allow-list is needed; if one is ever introduced,
// add it to THEME_ONLY_ALLOW below rather than weakening the assertion.
// ---------------------------------------------------------------------------
describe('theme parity', () => {
  // Intentional per-theme-only keys, by theme name. Keep empty unless a real
  // per-theme-only token is added — then list it explicitly here.
  const THEME_ONLY_ALLOW: Record<string, string[]> = {
    nocturne: [],
    daylight: [],
    midnight: [],
  };

  const expectedKeys = Object.keys(tokens.nocturne).sort();

  it('nocturne declares a non-empty key set', () => {
    expect(expectedKeys.length).toBeGreaterThan(0);
  });

  for (const t of THEMES) {
    it(`${t} declares the same key set as nocturne`, () => {
      const allow = new Set(THEME_ONLY_ALLOW[t] ?? []);
      const actual = Object.keys(tokens[t])
        .filter((k) => !allow.has(k))
        .sort();
      const expected = expectedKeys.filter(
        (k) => !(THEME_ONLY_ALLOW.nocturne ?? []).includes(k),
      );
      expect(actual).toEqual(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// Step CONTRAST — WCAG 2.1 contrast-pair CI guard.
// For each theme, compute the WCAG 2.1 contrast ratio between the key
// foreground/background pairs from the RESOLVED theme values and assert AA
// thresholds. (The relative-luminance formula is identical across
// WCAG 2.0–2.2, so the thresholds and claims carry across all three
// versions.) Uses the exported `parseHex` + `luminance` (see module-scope
// contrastRatio). A deliberately low-contrast pair (e.g. swapping --text for
// --text-faint) would trip these.
//
// Measured ratios (original pairs computed at authoring time 2026-06-28;
// extended 2026-11-06 under LW-074 with every pair whose ratio colors.css
// only asserted in a comment):
//   theme      text/bg  text/surface  on-accent/accent  muted/surface
//   nocturne    16.87      15.78           8.36              8.21
//   daylight    14.18      15.68           8.36              6.28
//   midnight    16.93      16.11           8.36              7.51
//   theme      accent-text/bg  accent-text/surface  subtle/bg  subtle/surface
//   nocturne        9.70              9.07             5.36        5.01
//   daylight        5.68              6.28             4.91        5.43
//   midnight       10.29              9.79             5.05        4.80
// All eight AA pairs × three themes clear 4.5:1 with margin (lowest =
// --text-subtle on --surface, midnight 4.80), so the full threshold is
// asserted everywhere — no large-text 3:1 relaxation required. Daylight's
// --accent-ring composites to 4.19 / 4.57 / 3.97 over its three light
// surfaces (≥3:1, its own it() below; the dark blocks assert no ring ratio).
// --text-faint measures 1.88–2.29:1 — it is NOT an AA pair: it is pinned with
// deliberately-inverted assertions (ghost-tier by law; see its it() and the
// README's decorative-only declaration).
// ---------------------------------------------------------------------------
describe('contrast', () => {
  const AA = 4.5;

  it('contrastRatio computes the canonical extremes', () => {
    // black on white is the maximal 21:1
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    // identical colors are 1:1
    expect(contrastRatio('#808080', '#808080')).toBeCloseTo(1, 5);
  });

  for (const t of THEMES) {
    it(`${t} meets WCAG 2.1 AA for the key foreground/background pairs`, () => {
      const m = resolveTheme(t);
      const text = m['--text'];
      const bg = m['--bg'];
      const surface = m['--surface'];
      const accent = m['--accent'];
      const onAccent = m['--text-on-accent'];
      const muted = m['--text-muted'];
      const accentText = m['--accent-text'];
      const subtle = m['--text-subtle'];

      // --text on --bg and on --surface
      expect(
        contrastRatio(text, bg),
        `${t}: --text on --bg`,
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contrastRatio(text, surface),
        `${t}: --text on --surface`,
      ).toBeGreaterThanOrEqual(AA);

      // --text-on-accent on --accent (the B2-unified ink, provably readable on amber)
      expect(
        contrastRatio(onAccent, accent),
        `${t}: --text-on-accent on --accent`,
      ).toBeGreaterThanOrEqual(AA);

      // --text-muted on --surface — current values clear full AA (no 3:1 relaxation)
      expect(
        contrastRatio(muted, surface),
        `${t}: --text-muted on --surface`,
      ).toBeGreaterThanOrEqual(AA);

      // --accent-text on --bg/--surface — LW-074: every theme block of
      // colors.css comments an AA claim for this token; the guard now
      // enforces the promise instead of leaving it prose.
      expect(
        contrastRatio(accentText, bg),
        `${t}: --accent-text on --bg`,
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contrastRatio(accentText, surface),
        `${t}: --accent-text on --surface`,
      ).toBeGreaterThanOrEqual(AA);

      // --text-subtle on --bg/--surface — LW-074: measured 4.80–5.43, clears
      // AA on every shipped surface, so the full threshold is pinned.
      expect(
        contrastRatio(subtle, bg),
        `${t}: --text-subtle on --bg`,
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contrastRatio(subtle, surface),
        `${t}: --text-subtle on --surface`,
      ).toBeGreaterThanOrEqual(AA);
    });
  }

  it('daylight --accent-ring composites to ≥3:1 on the light surfaces (LW-074)', () => {
    // colors.css:102's comment claims "≥3:1 focus ring on light bg/surface/
    // surface-2"; nothing ran that math. What the eye sees through a
    // translucent ring is the alpha composite, so the ratio is measured on
    // the composite, not the raw rgba.
    const m = resolveTheme('daylight');
    const ring = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(m['--accent-ring']);
    if (!ring) throw new Error(`daylight --accent-ring is not parseable rgba: ${m['--accent-ring']}`);
    const r = Number(ring[1]);
    const g = Number(ring[2]);
    const b = Number(ring[3]);
    const a = Number(ring[4]);
    for (const key of ['--bg', '--surface', '--surface-2']) {
      const surfaceHex = m[key];
      const s = parseHex(surfaceHex);
      if (!s) throw new Error(`unparseable daylight ${key}: ${surfaceHex}`);
      const composite = toHex({
        r: a * r + (1 - a) * s.r,
        g: a * g + (1 - a) * s.g,
        b: a * b + (1 - a) * s.b,
      });
      expect(
        contrastRatio(composite, surfaceHex),
        `daylight --accent-ring over ${key}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('pins --text-faint below 3:1 as the decorative-only tripwire (LW-074)', () => {
    // colors.css documents --text-faint as the ghost tier (measured
    // 1.88–2.29:1 on bg/surface — below AA AND below the 3:1 non-text floor).
    // The README therefore declares it decorative-only. These assertions are
    // INVERTED on purpose: if anyone lifts the faint values toward
    // readability, this test reddens so the README paragraph and the live
    // label sites (Login/Signup divider labels, SyncPlay placeholders) must
    // rotate in the same commit. A value move toward AA is an owner-gated
    // cascade (server ColorsCssParityTest pins colors.css bytes), never a
    // silent drive-by.
    for (const t of THEMES) {
      const m = resolveTheme(t);
      expect(
        contrastRatio(m['--text-faint'], m['--bg']),
        `${t}: --text-faint on --bg stays ghost-tier`,
      ).toBeLessThan(3);
      expect(
        contrastRatio(m['--text-faint'], m['--surface']),
        `${t}: --text-faint on --surface stays ghost-tier`,
      ).toBeLessThan(3);
    }
  });
});

// ---------------------------------------------------------------------------
// Step B4 — resolveValue nested-paren handling.
// The generator's `varRe` captures at most ONE level of nested parens inside a
// var() fallback. A two-level nest (e.g. clamp() containing calc()) would be
// mis-captured. resolveValue therefore fails closed: `assertVarFallbackDepth`
// throws on an over-nested fallback so it can never SILENTLY mis-resolve.
//
// These unit tests import the helpers from scripts/lib/tokens.mjs, which reads
// no files, writes no files and lists no directories, so importing it can never
// touch the tree. They used to import them from scripts/generate-tokens.mjs,
// which could only be safe because that file fenced its file-writing main()
// behind an `import.meta.url === pathToFileURL(process.argv[1]).href` guard —
// and that guard silently evaluated false through a symlink, turning
// `npm run generate` into a zero-output exit-0 no-op (see
// test/generate-tokens.test.mjs). The writing CLI now lives in
// scripts/generate-tokens.mjs with no guard at all and is not imported here.
// ---------------------------------------------------------------------------
import { resolveValue, assertVarFallbackDepth } from '../scripts/lib/tokens.mjs';

describe('resolveValue nested-paren handling (B4)', () => {
  it('resolves a one-level nested fallback (supported by varRe)', () => {
    // --x is undefined in scope → fall through to the clamp() fallback, which
    // contains exactly one level of nested parens and must resolve verbatim.
    const out = resolveValue('var(--x, clamp(1rem, 2vw, 3rem))', {});
    expect(out).toBe('clamp(1rem, 2vw, 3rem)');
  });

  it('resolves a one-level fallback against the scope when the ref exists', () => {
    const out = resolveValue('var(--a, 0)', { '--a': 'var(--b, 1)', '--b': '#fff' });
    expect(out).toBe('#fff');
  });

  it('throws a clear error on a two-level nested var() fallback (no silent mis-resolve)', () => {
    // clamp() whose middle arg is calc() = two levels of nesting in the fallback.
    const deep = 'var(--x, clamp(1rem, calc(2px + 1vw), 3rem))';
    expect(() => resolveValue(deep, {})).toThrowError(
      /nests parentheses deeper than the single-level resolver supports/,
    );
    // the guard itself throws too (exercised directly)
    expect(() => assertVarFallbackDepth(deep)).toThrow(/silently mis-resolve/);
  });

  it('does not throw on plain values or non-fallback var()', () => {
    expect(() => assertVarFallbackDepth('#0b0a08')).not.toThrow();
    expect(() => assertVarFallbackDepth('var(--accent)')).not.toThrow();
    expect(() => assertVarFallbackDepth('clamp(1rem, calc(2px + 1vw), 3rem)')).not.toThrow();
    // a non-var() function with deep nesting is fine — the guard only inspects
    // the part of a var() AFTER its fallback comma.
    expect(() => assertVarFallbackDepth('var(--x, rgba(0,0,0,0.5))')).not.toThrow();
  });
});
