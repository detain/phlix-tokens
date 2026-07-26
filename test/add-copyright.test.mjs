/**
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// Regression test for injectCssComment() in scripts/add-copyright.mjs.
//
// Root cause (fixed here): the function used to scan for the LAST line
// containing `*/` in the WHOLE file instead of the terminator of the
// file's OWN opening comment block. Every CSS token file has later
// `/* ... */` annotation comments (including inline trailing comments on
// individual declarations), so the stray copyright line landed on
// whatever comment happened to close last in the file — mid-`:root{}`,
// between two declarations, as a naked line with no `/* */` delimiters.
// That exact defect shipped in commit 9ec4298 and corrupted 5 CSS files
// (fixed in PR #9). This is a plain Node .mjs test (not .ts) because the
// module under test is plain Node ESM, not part of the TS project
// (mirrors the `scripts/**/*.mjs` carve-out in eslint.config.js).
//
// This is a pure-function test: it imports injectCssComment/prependCssComment
// directly. Importing the module is safe — its file-walking/writing "main"
// section is guarded behind an `import.meta.url === pathToFileURL(process.argv[1]).href`
// check, so importing it under vitest never touches the filesystem.

import { describe, it, expect } from 'vitest';
import { injectCssComment, prependCssComment, COPYRIGHT } from '../scripts/add-copyright.mjs';

function process_(content) {
  if (content.includes('detain@interserver.net')) return null;
  return injectCssComment(content) ?? prependCssComment(content);
}

describe('injectCssComment (CSS copyright injection)', () => {
  it('inserts inside the OPENING docblock, not a later annotation comment', () => {
    const input = [
      '/**',
      ' * motion.css - motion/duration design tokens.',
      ' *',
      ' * Framework-agnostic CSS custom properties.',
      ' * Generated from src/tokens.ts — do not hand-edit.',
      ' */',
      '',
      ':root {',
      '  --dur-fast: 120ms;',
      '  --dur-slow: 320ms;',
      '  --dur-slower: 480ms;',
      '}',
      '',
      '/* Reduced-motion override annotation */',
      '@media (prefers-reduced-motion: reduce) {',
      '  :root {',
      '    --dur-fast: 0ms;',
      '  }',
      '}',
      '',
    ].join('\n');

    const result = process_(input);
    const lines = result.split('\n');
    const copyIdx = lines.findIndex((l) => l.includes('@copyright'));

    // Landed inside the opening docblock (before its closing ` */`), not
    // after the `:root{}` block and not touching the later annotation.
    expect(copyIdx).toBeGreaterThan(0);
    expect(copyIdx).toBeLessThan(lines.indexOf(' */'));
    expect(lines).toContain(':root {');
    expect(lines).toContain('  --dur-slower: 480ms;'); // no declaration swallowed
    expect(result).toContain('/* Reduced-motion override annotation */');
    // The stray line must never appear as a naked line right before the
    // later annotation comment (the historical corruption shape).
    const annotationIdx = lines.findIndex((l) => l.includes('Reduced-motion override annotation'));
    expect(lines[annotationIdx - 1]).not.toContain('@copyright');
  });

  it('does not split a declaration inside :root{} (the exact 9ec4298 shape)', () => {
    // Mirrors src/css/radius.css before PR #9: a two-line `/* */` opening
    // comment, then :root{} declarations each with an inline trailing
    // `/* ... */` comment (which is what made the OLD "last */" scan pick
    // a line deep inside the block).
    const input = [
      '/* @phlix/ui — Radius scale (Nocturne, R0.1). Theme-invariant.',
      '   Softer, more cinematic radii than the 0.7.0 baseline. */',
      ':root {',
      '  --radius-sm: 6px;     /* badges, ticks, kbd */',
      '  --radius-md: 10px;    /* buttons, inputs, chips */',
      '  --radius-lg: 14px;    /* posters, cards, thumbs */',
      '  --radius-xl: 20px;    /* filter bar, player, panels */',
      '  --radius-2xl: 28px;   /* large sheets, hero */',
      '  --radius-full: 9999px;',
      '}',
      '',
    ].join('\n');

    const result = process_(input);
    const lines = result.split('\n');

    // Every original declaration line must survive completely intact.
    expect(lines).toContain('  --radius-sm: 6px;     /* badges, ticks, kbd */');
    expect(lines).toContain('  --radius-md: 10px;    /* buttons, inputs, chips */');
    expect(lines).toContain('  --radius-lg: 14px;    /* posters, cards, thumbs */');
    expect(lines).toContain('  --radius-xl: 20px;    /* filter bar, player, panels */');
    expect(lines).toContain('  --radius-2xl: 28px;   /* large sheets, hero */');
    expect(lines).toContain('  --radius-full: 9999px;');

    // The copyright line must land BEFORE `:root {`, i.e. inside the
    // opening comment, never inside the block.
    const rootIdx = lines.indexOf(':root {');
    const copyIdx = lines.findIndex((l) => l.includes('@copyright'));
    expect(copyIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeLessThan(rootIdx);

    // No naked `* @copyright` line (missing `/* */` delimiters) anywhere —
    // that shape is exactly what corrupted the CSS in 9ec4298.
    for (const line of lines) {
      if (line.includes('@copyright')) {
        expect(line.trim().startsWith('*')).toBe(true);
      }
    }
  });

  it('prepends a fresh header when the file has no leading comment at all', () => {
    const input = [':root {', '  --stack-gap: 0.625rem;', '}', '', '.eyebrow {', '  color: red;', '}', ''].join(
      '\n',
    );

    const result = process_(input);
    const lines = result.split('\n');

    expect(lines[0]).toBe('/*');
    expect(lines.some((l) => l.includes('@copyright'))).toBe(true);
    // The eyebrow rule and every original declaration must be untouched.
    expect(result).toContain(':root {');
    expect(result).toContain('  --stack-gap: 0.625rem;');
    expect(result).toContain('.eyebrow {');
  });

  it('handles a single-line `/* */` opening comment by expanding it, not injecting mid-file', () => {
    const input = [
      '/* */',
      ':root {',
      '  --dur-fast: 120ms;',
      '  --dur-slow: 320ms;',
      '}',
      '',
      '/* a later annotation comment */',
      '.foo {',
      '  color: red;',
      '}',
      '',
    ].join('\n');

    const result = process_(input);
    const lines = result.split('\n');
    const rootIdx = lines.indexOf(':root {');
    const copyIdx = lines.findIndex((l) => l.includes('@copyright'));

    expect(copyIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeLessThan(rootIdx);
    // Declarations and the later annotation are untouched.
    expect(result).toContain('  --dur-fast: 120ms;');
    expect(result).toContain('  --dur-slow: 320ms;');
    expect(result).toContain('/* a later annotation comment */');
  });

  it('is idempotent: a file that already has the copyright is left alone', () => {
    const input = ['/**', ' * already has it', ' *', COPYRIGHT, ' */', '', ':root { --x: 1; }', ''].join('\n');

    expect(process_(input)).toBeNull();
  });
});
