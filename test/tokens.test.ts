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
// Step CONTRAST — WCAG contrast-pair CI guard.
// For each theme, compute the WCAG 2.x contrast ratio between the key
// foreground/background pairs from the RESOLVED theme values and assert AA
// thresholds. Uses the exported `parseHex` + `luminance`. A deliberately
// low-contrast pair (e.g. swapping --text for --text-faint) would trip these.
//
// Measured ratios (current values, computed at authoring time 2026-06-28):
//   theme      text/bg  text/surface  on-accent/accent  muted/surface
//   nocturne    16.87      15.78           8.36              8.21
//   daylight    14.18      15.68           8.36              6.28
//   midnight    16.93      16.11           8.36              7.51
// All pairs clear AA 4.5:1 with margin — including --text-muted on --surface
// (lowest = daylight 6.28), so the full 4.5:1 threshold is asserted for muted
// (no large-text 3:1 relaxation required).
// ---------------------------------------------------------------------------
describe('contrast', () => {
  const AA = 4.5;

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

  it('contrastRatio computes the canonical extremes', () => {
    // black on white is the maximal 21:1
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    // identical colors are 1:1
    expect(contrastRatio('#808080', '#808080')).toBeCloseTo(1, 5);
  });

  for (const t of THEMES) {
    it(`${t} meets WCAG AA for the key foreground/background pairs`, () => {
      const m = resolveTheme(t);
      const text = m['--text'];
      const bg = m['--bg'];
      const surface = m['--surface'];
      const accent = m['--accent'];
      const onAccent = m['--text-on-accent'];
      const muted = m['--text-muted'];

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
    });
  }
});
