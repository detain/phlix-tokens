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
    // light accent → dark ink contrast
    expect(vars['--accent-contrast']).toBe('#1a1205');
  });

  it('picks light ink for a dark accent', () => {
    const vars = deriveAccentVars('#101010') as Record<string, string>;
    expect(vars['--accent-contrast']).toBe('#fff8ec');
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
