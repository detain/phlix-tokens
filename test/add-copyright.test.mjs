/**
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// Tests for the CSS copyright injection in scripts/lib/copyright.mjs.
//
// Root cause of the original defect (fixed in the accompanying change): the
// function used to scan for the LAST line containing `*/` in the WHOLE file
// instead of the terminator of the file's OWN opening comment block. Every CSS
// token file has later `/* ... */` annotation comments (including inline
// trailing comments on individual declarations), so the stray copyright line
// landed on whatever comment happened to close last in the file — mid-`:root{}`,
// between two declarations, as a naked line with no `/* */` delimiters. That
// exact defect shipped in commit 9ec4298 and corrupted 5 CSS files (fixed in
// PR #9).
//
// NOT every case below is a regression guard, and they are labelled so the
// distinction survives. Each `it()` carries one of:
//
//   REGRESSION (9ec4298)  — fails against the pre-fix `lastCloseIdx` scan on
//                           origin/master. These are the real guards for the
//                           shipped corruption.
//   REGRESSION (this fix) — passes on origin/master but fails against the first
//                           cut of the fix, which mis-handled a degenerate
//                           `/*/` first line, injected an LF line into a CRLF
//                           file, and narrowed the duplicate guard to the
//                           opening block only. Guards for defects introduced
//                           while fixing the first one.
//   CHARACTERIZATION      — passes both before and after; documents intended
//                           behaviour, does not discriminate. Kept on purpose,
//                           but do not mistake it for a guard.
//
// This is a plain Node .mjs test (not .ts) because the module under test is
// plain Node ESM and is outside the TypeScript project: tsconfig.json's
// `include` is ["src/**/*.ts", "src/**/*.d.ts", "test/**/*.ts",
// "scripts/**/*.d.mts"], none of which match a `.mjs` file, so `npm run
// typecheck` never sees it. (It needs no ESLint carve-out either — it imports
// everything it uses and declares no Node globals.)
//
// This is a pure-function test: it imports injectCssComment/prependCssComment
// from scripts/lib/copyright.mjs, which reads no files, writes no files and
// walks no directories, so importing it can never touch the tree. The walking
// CLI lives in scripts/add-copyright.mjs and is not imported here.

import { describe, it, expect } from 'vitest';
import { injectCssComment, prependCssComment, COPYRIGHT } from '../scripts/lib/copyright.mjs';

// Mirrors scripts/add-copyright.mjs::processCssFile — the whole-content
// pre-check plus the inject-or-prepend dispatch.
function process_(content) {
  if (content.includes('detain@interserver.net')) return null;
  return injectCssComment(content) ?? prependCssComment(content);
}

describe('injectCssComment (CSS copyright injection)', () => {
  // REGRESSION (9ec4298)
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

  // REGRESSION (9ec4298)
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

  // CHARACTERIZATION — the pre-fix code behaves identically here.
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

  // REGRESSION (9ec4298)
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

  // REGRESSION (this fix) — a degenerate `/*/` first line SHARES its `*`
  // between the opener and the apparent closer (`'/*/'.indexOf('*/') === 1`).
  // Treating index 1 as the terminator split the line into a bare `/` plus a
  // stray ` */`, destroying a source character and emitting unparseable CSS.
  it('does not corrupt a degenerate `/*/` first line — falls back to prepending', () => {
    const input = ['/*/', ':root { --x: 1; }', ''].join('\n');

    // There is no terminator for the opening comment, so injection must decline.
    expect(injectCssComment(input)).toBeNull();

    const result = process_(input);
    const lines = result.split('\n');

    // The input survives verbatim, appended after a freshly prepended header.
    expect(result.endsWith(input)).toBe(true);
    expect(result).toContain('/*/');

    // The prepended header is a well-formed block comment, and no line was
    // reduced to a bare `/` (the corruption shape).
    expect(lines[0]).toBe('/*');
    const copyIdx = lines.findIndex((l) => l.includes('@copyright'));
    expect(copyIdx).toBe(1);
    expect(lines[2]).toBe(' */');
    expect(lines).not.toContain('/');
    // Every `*/` in the output is preceded by a matching `/*` opener.
    expect((result.match(/\/\*/g) || []).length).toBeGreaterThanOrEqual(
      (result.match(/\*\//g) || []).length,
    );
  });

  // REGRESSION (this fix) — an injected line must adopt the file's own EOL.
  // A bare-LF line inside an otherwise CRLF file is exactly the class of
  // mixed-EOL damage this estate has been bitten by before.
  it('preserves CRLF line endings on the lines it injects', () => {
    const hasOnlyCrlf = (s) => !/(^|[^\r])\n/.test(s);

    // Multi-line opening comment → the "insert before the closer" branch.
    const multi = ['/**', ' * hdr', ' *', ' */', '', ':root { --x: 1; }', ''].join('\r\n');
    const multiOut = process_(multi);
    expect(multiOut).toContain('@copyright');
    expect(hasOnlyCrlf(multiOut)).toBe(true);
    expect(multiOut).toContain(COPYRIGHT + '\r\n');

    // Single-line opening comment → the "expand into a block" branch.
    const single = ['/* */', ':root { --x: 1; }', ''].join('\r\n');
    const singleOut = process_(single);
    expect(singleOut).toContain('@copyright');
    expect(hasOnlyCrlf(singleOut)).toBe(true);
    expect(singleOut.startsWith('/*\r\n')).toBe(true);

    // No opening comment at all → the prepend branch.
    const bare = [':root { --x: 1; }', ''].join('\r\n');
    const bareOut = process_(bare);
    expect(bareOut).toContain('@copyright');
    expect(hasOnlyCrlf(bareOut)).toBe(true);

    // LF files stay pure LF — the CR is adopted from the input, never added.
    const lf = ['/**', ' * hdr', ' *', ' */', '', ':root { --x: 1; }', ''].join('\n');
    expect(process_(lf)).not.toContain('\r');
  });

  // CHARACTERIZATION — the pre-fix code returns null here too.
  it('is idempotent: a file that already has the copyright is left alone', () => {
    const input = ['/**', ' * already has it', ' *', COPYRIGHT, ' */', '', ':root { --x: 1; }', ''].join('\n');

    expect(process_(input)).toBeNull();
    // ...and directly, without the CLI's whole-content pre-check in front.
    expect(injectCssComment(input)).toBeNull();
  });

  // REGRESSION (this fix) — the exported function's duplicate guard must cover
  // the WHOLE content, not just the opening block. Narrowing it to the opening
  // block made a standalone call inject a SECOND copyright into a file that
  // already had one further down.
  it('refuses a file whose existing copyright sits outside the opening block', () => {
    const input = ['/*', ' * hdr', ' */', ':root { --x: 1; }', '/* ' + COPYRIGHT.trim() + ' */', ''].join('\n');

    // Called directly — no process_() helper, whose own whole-content check
    // would mask a narrowed guard inside injectCssComment().
    expect(injectCssComment(input)).toBeNull();

    // Belt and braces: exactly one copyright line, i.e. nothing was added.
    const occurrences = (input.match(/@copyright/g) || []).length;
    expect(occurrences).toBe(1);
  });
});
