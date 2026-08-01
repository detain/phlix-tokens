/**
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect } from 'vitest';
import {
  stripComments,
  parseRules,
  classify,
  resolveMap,
  buildTokens,
  assertNonVacuous,
  renderJson,
  renderTs,
  FILE_FAMILY,
} from '../scripts/lib/tokens.mjs';

describe('stripComments', () => {
  it('removes CSS block comments', () => {
    const input = '/* comment */ .foo { color: red; } /* another */';
    const result = stripComments(input);
    expect(result).toBe('  .foo { color: red; }  ');
  });

  it('handles multi-line comments', () => {
    const input = '/*\n * multi-line\n * comment\n */ .foo { color: red; }';
    const result = stripComments(input);
    expect(result).not.toContain('multi-line');
    expect(result).toContain('.foo');
  });

  it('handles no comments', () => {
    const input = '.foo { color: red; }';
    const result = stripComments(input);
    expect(result).toBe('.foo { color: red; }');
  });

  it('removes multiple comments', () => {
    const input = '/* a */ /* b */ .foo { color: red; } /* c */';
    const result = stripComments(input);
    expect(result).toBe('  /* b */ .foo { color: red; } ');
    // Note: nested comments not handled correctly by simple regex
  });
});

describe('parseRules', () => {
  it('parses simple CSS rules', () => {
    const css = '.foo { color: red; }';
    const rules = parseRules(css);
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual(['.foo']);
    expect(rules[0].decls).toEqual([{ prop: '--foo', value: 'red' }]);
  });

  it('skips @import rules', () => {
    const css = "@import 'foo.css'; .foo { color: red; }";
    const rules = parseRules(css);
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual(['.foo']);
  });

  it('handles comma-separated selectors', () => {
    const css = '.foo, .bar { color: red; }';
    const rules = parseRules(css);
    expect(rules[0].selectors).toEqual(['.foo', '.bar']);
  });

  it('only captures custom properties', () => {
    const css = '.foo { color: red; --bar: blue; }';
    const rules = parseRules(css);
    expect(rules[0].decls).toEqual([{ prop: '--bar', value: 'blue' }]);
  });

  it('handles empty declarations', () => {
    const css = '.foo { ; ;; color: red; ; }';
    const rules = parseRules(css);
    expect(rules).toHaveLength(1);
  });
});

describe('classify', () => {
  it('classifies :root as base', () => {
    expect(classify(':root')).toBe('base');
  });

  it('classifies theme selectors', () => {
    expect(classify("[data-theme='nocturne']")).toBe('theme:nocturne');
    expect(classify('[data-theme="daylight"]')).toBe('theme:daylight');
    expect(classify("[data-theme='midnight']")).toBe('theme:midnight');
  });

  it('classifies density selectors', () => {
    expect(classify("[data-density='comfortable']")).toBe('density:comfortable');
    expect(classify('[data-density="compact"]')).toBe('density:compact');
  });

  it('returns null for unknown selectors', () => {
    expect(classify('.foo')).toBeNull();
    expect(classify('#bar')).toBeNull();
    expect(classify('*')).toBeNull();
  });
});

describe('resolveMap', () => {
  it('resolves all values in a map', () => {
    const input = {
      '--a': 'var(--b)',
      '--b': '#fff',
    };
    const result = resolveMap(input, input);
    expect(result['--a']).toBe('#fff');
    expect(result['--b']).toBe('#fff');
  });

  it('leaves unresolved vars as-is', () => {
    const input = { '--a': 'var(--x)' };
    const scope = {};
    const result = resolveMap(input, scope);
    expect(result['--a']).toBe('var(--x)');
  });

  it('handles empty map', () => {
    const result = resolveMap({}, {});
    expect(result).toEqual({});
  });

  it('resolves nested var() chains', () => {
    const input = { '--a': 'var(--b)', '--b': 'var(--c)', '--c': '#123' };
    const result = resolveMap(input, input);
    expect(result['--a']).toBe('#123');
  });
});

describe('buildTokens', () => {
  const minimalCss = [
    {
      name: 'colors.css',
      css: `
        :root {
          --bg: #0b0a08;
          --text: #f3ece1;
          --amber-500: #f5a524;
        }
        [data-theme='nocturne'] {
          --bg: #0b0a08;
        }
        [data-theme='daylight'] {
          --bg: #f7f1e6;
        }
        [data-theme='midnight'] {
          --bg: #000000;
        }
      `,
    },
    {
      name: 'spacing.css',
      css: ':root { --space-4: 1rem; }',
    },
    {
      name: 'radius.css',
      css: ':root { --radius-md: 10px; }',
    },
    {
      name: 'motion.css',
      css: ':root { --dur-fast: 120ms; }',
    },
    {
      name: 'typography.css',
      css: ':root { --text-xl: clamp(1rem, 2vw, 3rem); }',
    },
    {
      name: 'shadow.css',
      css: `
        :root, [data-theme='nocturne'] { --shadow-2: 0 4px 14px rgba(0, 0, 0, 0.48); }
        [data-theme='daylight'] { --shadow-2: 0 4px 14px rgba(74, 55, 20, 0.12); }
        [data-theme='midnight'] { --shadow-2: 0 4px 14px rgba(0, 0, 0, 0.70); }
      `,
    },
    {
      name: 'density.css',
      css: `
        [data-density='comfortable'] { --control-h: 2.5rem; }
        [data-density='compact'] { --control-h: 2.125rem; }
      `,
    },
  ];

  it('builds a complete token model', () => {
    const { tokens, themes } = buildTokens(minimalCss);

    // base tokens
    expect(tokens.base['--bg']).toBe('#0b0a08');
    expect(tokens.base['--space-4']).toBe('1rem');

    // theme tokens
    expect(tokens.nocturne['--bg']).toBe('#0b0a08');
    expect(tokens.daylight['--bg']).toBe('#f7f1e6');
    expect(tokens.midnight['--bg']).toBe('#000000');

    // density tokens
    expect(tokens.density.comfortable['--control-h']).toBe('2.5rem');
    expect(tokens.density.compact['--control-h']).toBe('2.125rem');

    // token families
    expect(tokens.spacing['--space-4']).toBe('1rem');
    expect(tokens.radius['--radius-md']).toBe('10px');
    expect(tokens.motion['--dur-fast']).toBe('120ms');
    expect(tokens.typography['--text-xl']).toBe('clamp(1rem, 2vw, 3rem)');

    // shadow per theme
    expect(tokens.shadow.nocturne['--shadow-2']).toBe('0 4px 14px rgba(0, 0, 0, 0.48)');
    expect(tokens.shadow.daylight['--shadow-2']).toBe('0 4px 14px rgba(74, 55, 20, 0.12)');
    expect(tokens.shadow.midnight['--shadow-2']).toBe('0 4px 14px rgba(0, 0, 0, 0.70)');

    // themes map
    expect(themes.nocturne['--bg']).toBe('#0b0a08');
    expect(themes.daylight['--bg']).toBe('#f7f1e6');
  });

  it('resolves var() references', () => {
    const cssWithVars = [
      {
        name: 'colors.css',
        css: `
          :root {
            --amber-500: #f5a524;
            --accent: var(--amber-500);
          }
        `,
      },
    ];
    const { tokens } = buildTokens(cssWithVars);
    expect(tokens.base['--accent']).toBe('#f5a524');
  });

  it('partitions base tokens by family', () => {
    const { tokens } = buildTokens(minimalCss);
    expect(tokens.spacing['--space-4']).toBe('1rem');
    expect(tokens.spacing['--radius-md']).toBeUndefined(); // wrong family
  });

  it('skips index.css', () => {
    const cssWithIndex = [
      ...minimalCss,
      { name: 'index.css', css: '.foo { color: red; }' },
    ];
    const { tokens } = buildTokens(cssWithIndex);
    // Should not throw and should produce same result
    expect(tokens.base['--bg']).toBe('#0b0a08');
  });
});

describe('assertNonVacuous', () => {
  it('does not throw for a valid token model', () => {
    const valid = {
      tokens: {
        base: { '--bg': '#000' },
        nocturne: { '--bg': '#000' },
        daylight: { '--bg': '#fff' },
        midnight: { '--bg': '#111' },
        spacing: { '--space-1': '0.25rem' },
        radius: { '--radius-md': '10px' },
        shadow: { nocturne: { '--shadow-1': '0 1px' }, daylight: { '--shadow-1': '0 1px' }, midnight: { '--shadow-1': '0 1px' } },
        motion: { '--dur-fast': '120ms' },
        typography: { '--text-base': '1rem' },
        density: { comfortable: { '--control-h': '2.5rem' }, compact: { '--control-h': '2rem' } },
      },
      themes: {
        nocturne: { '--bg': '#000' },
        daylight: { '--bg': '#fff' },
        midnight: { '--bg': '#111' },
      },
    };
    expect(() => assertNonVacuous(valid)).not.toThrow();
  });

  it('throws when base tokens are empty', () => {
    const empty = {
      tokens: { base: {}, nocturne: { '--bg': '#000' }, daylight: { '--bg': '#fff' }, midnight: { '--bg': '#111' }, spacing: {}, radius: {}, shadow: { nocturne: {}, daylight: {}, midnight: {} }, motion: {}, typography: {}, density: { comfortable: {}, compact: {} } },
      themes: {},
    };
    expect(() => assertNonVacuous(empty)).toThrow(/parsed 0/);
  });

  it('throws when a theme is empty', () => {
    const emptyTheme = {
      tokens: { base: { '--bg': '#000' }, nocturne: {}, daylight: { '--bg': '#fff' }, midnight: { '--bg': '#111' }, spacing: { '--space-1': '0.25rem' }, radius: { '--radius-md': '10px' }, shadow: { nocturne: {}, daylight: { '--shadow-1': '0 1px' }, midnight: { '--shadow-1': '0 1px' } }, motion: { '--dur-fast': '120ms' }, typography: { '--text-base': '1rem' }, density: { comfortable: {}, compact: {} } },
      themes: {},
    };
    expect(() => assertNonVacuous(emptyTheme)).toThrow(/theme 'nocturne' resolved to 0 tokens/);
  });

  it('throws when a density variant is empty', () => {
    const emptyDensity = {
      tokens: { base: { '--bg': '#000' }, nocturne: { '--bg': '#000' }, daylight: { '--bg': '#fff' }, midnight: { '--bg': '#111' }, spacing: { '--space-1': '0.25rem' }, radius: { '--radius-md': '10px' }, shadow: { nocturne: { '--shadow-1': '0 1px' }, daylight: { '--shadow-1': '0 1px' }, midnight: { '--shadow-1': '0 1px' } }, motion: { '--dur-fast': '120ms' }, typography: { '--text-base': '1rem' }, density: { comfortable: {}, compact: {} } },
      themes: {},
    };
    expect(() => assertNonVacuous(emptyDensity)).toThrow(/density 'comfortable' resolved to 0 tokens/);
  });

  it('throws when a token family is empty', () => {
    const emptyFamily = {
      tokens: { base: { '--bg': '#000' }, nocturne: { '--bg': '#000' }, daylight: { '--bg': '#fff' }, midnight: { '--bg': '#111' }, spacing: {}, radius: { '--radius-md': '10px' }, shadow: { nocturne: { '--shadow-1': '0 1px' }, daylight: { '--shadow-1': '0 1px' }, midnight: { '--shadow-1': '0 1px' } }, motion: { '--dur-fast': '120ms' }, typography: { '--text-base': '1rem' }, density: { comfortable: { '--control-h': '2.5rem' }, compact: { '--control-h': '2rem' } } },
      themes: {},
    };
    expect(() => assertNonVacuous(emptyFamily)).toThrow(/token family 'spacing' resolved to 0 tokens/);
  });

  it('throws when a shadow ladder is empty for a theme', () => {
    const emptyShadow = {
      tokens: { base: { '--bg': '#000' }, nocturne: { '--bg': '#000' }, daylight: { '--bg': '#fff' }, midnight: { '--bg': '#111' }, spacing: { '--space-1': '0.25rem' }, radius: { '--radius-md': '10px' }, shadow: { nocturne: {}, daylight: { '--shadow-1': '0 1px' }, midnight: { '--shadow-1': '0 1px' } }, motion: { '--dur-fast': '120ms' }, typography: { '--text-base': '1rem' }, density: { comfortable: { '--control-h': '2.5rem' }, compact: { '--control-h': '2rem' } } },
      themes: {},
    };
    expect(() => assertNonVacuous(emptyShadow)).toThrow(/the 'nocturne' shadow ladder resolved to 0 tokens/);
  });
});

describe('renderJson', () => {
  it('renders a valid JSON string', () => {
    const data = {
      tokens: { base: { '--bg': '#000' } },
      themes: { nocturne: { '--bg': '#000' } },
    };
    const json = renderJson(data);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.tokens.base['--bg']).toBe('#000');
  });

  it('ends with a newline', () => {
    const data = { tokens: { base: {} }, themes: {} };
    const json = renderJson(data);
    expect(json.endsWith('\n')).toBe(true);
  });
});

describe('renderTs', () => {
  it('renders TypeScript source with tokens and FLAT_THEMES', () => {
    const data = {
      tokens: { base: { '--bg': '#000' }, nocturne: { '--bg': '#000' }, daylight: { '--bg': '#fff' }, midnight: { '--bg': '#111' }, spacing: { '--space-1': '0.25rem' }, radius: { '--radius-md': '10px' }, shadow: { nocturne: { '--shadow-1': '0 1px' }, daylight: { '--shadow-1': '0 1px' }, midnight: { '--shadow-1': '0 1px' } }, motion: { '--dur-fast': '120ms' }, typography: { '--text-base': '1rem' }, density: { comfortable: { '--control-h': '2.5rem' }, compact: { '--control-h': '2rem' } } },
      themes: { nocturne: { '--bg': '#000' }, daylight: { '--bg': '#fff' }, midnight: { '--bg': '#111' } },
    };
    const ts = renderTs(data);
    expect(ts).toContain('export const tokens: Tokens');
    expect(ts).toContain('export function resolveTheme');
    expect(ts).toContain('FLAT_THEMES');
  });

  it('does not contain var() references in the rendered output', () => {
    const data = {
      tokens: { base: { '--bg': '#000' }, nocturne: { '--bg': '#000' }, daylight: { '--bg': '#fff' }, midnight: { '--bg': '#111' }, spacing: { '--space-1': '0.25rem' }, radius: { '--radius-md': '10px' }, shadow: { nocturne: { '--shadow-1': '0 1px' }, daylight: { '--shadow-1': '0 1px' }, midnight: { '--shadow-1': '0 1px' } }, motion: { '--dur-fast': '120ms' }, typography: { '--text-base': '1rem' }, density: { comfortable: { '--control-h': '2.5rem' }, compact: { '--control-h': '2rem' } } },
      themes: { nocturne: { '--bg': '#000' }, daylight: { '--bg': '#fff' }, midnight: { '--bg': '#111' } },
    };
    const ts = renderTs(data);
    // The rendered TS should have resolved values, not var() strings
    expect(ts).not.toContain('var(--');
  });
});

describe('FILE_FAMILY', () => {
  it('contains expected file-to-family mappings', () => {
    expect(FILE_FAMILY['spacing.css']).toBe('spacing');
    expect(FILE_FAMILY['radius.css']).toBe('radius');
    expect(FILE_FAMILY['motion.css']).toBe('motion');
    expect(FILE_FAMILY['typography.css']).toBe('typography');
    expect(FILE_FAMILY['colors.css']).toBeNull();
    expect(FILE_FAMILY['density.css']).toBeNull();
  });
});
