/**
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// Tests for the copyright-header injection helpers (CSS and TS/JS) in
// scripts/lib/copyright.mjs.
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
// distinction survives. Each case's label is derived from ONE measured
// signature — (result of running THIS test body against origin/master's
// implementation, result against 7cb90da's, the first `*/`-scan fix attempt)
// — so the four categories below partition all 12 cases exhaustively and
// disjointly; every label is mechanically checkable against that pair of
// runs, not a matter of judgement:
//
//   REGRESSION (9ec4298)      — FAILS against origin/master, PASSES against
//                           7cb90da. The original shipped defect: master
//                           scanned for the LAST `*/` in the whole file
//                           instead of the terminator of its OWN opening
//                           comment, so a later `/* ... */` annotation
//                           comment (every CSS token file has several,
//                           including inline trailing comments on individual
//                           declarations) decided where the stray copyright
//                           line landed — mid-`:root{}`, between two
//                           declarations, as a naked line with no
//                           delimiters. That shipped in 9ec4298 and corrupted
//                           5 CSS files (fixed in PR #9). 7cb90da's first-cut
//                           fix (scan for the FIRST `*/` instead) already
//                           resolves this signature, so these are the real
//                           regression guards for the shipped corruption.
//   REGRESSION (this fix)    — PASSES against origin/master, FAILS against
//                           7cb90da. A defect INTRODUCED by 7cb90da's
//                           first-cut fix itself — master never attempted the
//                           behaviour being guarded, so there was nothing
//                           there to get wrong — and fixed in this round: a
//                           degenerate `/*/` first line mis-handled, and the
//                           duplicate guard narrowed to the opening block
//                           only.
//   REGRESSION (pre-existing) — FAILS against BOTH origin/master and
//                           7cb90da. Unlike the category above, the defect
//                           was NOT introduced by either `*/`-scan fix
//                           attempt: `prependCssComment()` and `crFor()` are
//                           byte-identical between master and 7cb90da, so
//                           whatever they got wrong (or never attempted),
//                           they got wrong identically, before this branch
//                           ever touched the file. Covers two unrelated
//                           defects, both repaired only because this round
//                           touched the same functions for other reasons:
//                           EOL (CRLF) preservation, absent from every prior
//                           implementation of `injectCssComment()` and
//                           `prependCssComment()` (round-2 review finding 6,
//                           round-3 review finding 1); and a leading UTF-8
//                           BOM being emitted IN FRONT of a fresh header
//                           instead of after it, in BOTH
//                           `prependCssComment()` (round-2 review, finding 8)
//                           and `prependTsDocblock()` (round-3 review,
//                           finding 5). No tracked file in this repo carries
//                           a leading BOM at all, so the BOM half of this
//                           category has zero production exposure today.
//   CHARACTERIZATION         — PASSES against BOTH origin/master and 7cb90da.
//                           Documents intended behaviour without
//                           discriminating between any implementation. Kept
//                           on purpose, but do not mistake it for a guard.
//
// This is a plain Node .mjs test (not .ts) because the module under test is
// plain Node ESM and is outside the TypeScript project: tsconfig.json's
// `include` is ["src/**/*.ts", "src/**/*.d.ts", "test/**/*.ts",
// "scripts/**/*.d.mts"], none of which match a `.mjs` file, so `npm run
// typecheck` never sees it. (It needs no ESLint carve-out either — it imports
// everything it uses and declares no Node globals.)
//
// This is a pure-function test: it imports injectCssComment/prependCssComment/
// prependTsDocblock from scripts/lib/copyright.mjs, which reads no files,
// writes no files and walks no directories, so importing it can never touch
// the tree. The walking CLI lives in scripts/add-copyright.mjs and is not
// imported here.

import { describe, it, expect } from 'vitest';
import { injectCssComment, prependCssComment, prependTsDocblock, COPYRIGHT, MARKER } from '../scripts/lib/copyright.mjs';

// Mirrors scripts/add-copyright.mjs::processCssFile — the whole-content
// pre-check plus the inject-or-prepend dispatch. MARKER is imported from the
// same lib module that defines it (round-2 review, finding 3): before this,
// the marker substring existed as three independent copies (this file,
// scripts/add-copyright.mjs, and scripts/lib/copyright.mjs itself) that all
// had to be kept in sync by hand despite deciding idempotency for every
// caller. Now the lib is the single source and this test imports it.
function process_(content) {
  if (content.includes(MARKER)) return null;
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

  // REGRESSION (pre-existing) — an injected line must adopt the file's own
  // EOL. Fails against BOTH origin/master and 7cb90da: neither had any
  // EOL-preservation logic at all (prependCssComment() and crFor() are
  // byte-identical between the two), so this predates and is independent of
  // the `*/`-scan fix — round-2 review, finding 6. A bare-LF line inside an
  // otherwise CRLF file is exactly the class of mixed-EOL damage this estate
  // has been bitten by before.
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

  // CHARACTERIZATION — coverage added for round-2 review finding 1. The case
  // above ("refuses a file whose existing copyright sits outside the opening
  // block") calls injectCssComment() DIRECTLY, so it never exercises the
  // composition every real caller actually uses:
  // `injectCssComment(content) ?? prependCssComment(content)`, gated by an
  // OUTER whole-content marker pre-check (add-copyright.mjs::processCssFile,
  // and this file's own process_() helper). That composition passes
  // identically on origin/master, the first-cut fix, and this PR — the outer
  // pre-check has always made it safe — so this does not discriminate
  // between implementations. It exists to prove the thing the corrected
  // docblock on injectCssComment() now says explicitly: following the
  // documented contract (pre-check the marker; only compose when it's
  // absent) cannot yield a double header.
  it('the composed caller path (outer marker pre-check + inject-or-prepend) never doubles the header', () => {
    const input = ['/*', ' * hdr', ' */', ':root { --x: 1; }', '/* ' + COPYRIGHT.trim() + ' */', ''].join('\n');

    // The real composition every caller uses: pre-check the whole content
    // for the marker, and only reach injectCssComment/prependCssComment when
    // it is absent.
    const result = process_(input);
    expect(result).toBeNull(); // the outer pre-check caught it before injectCssComment ran

    // Contrast: a caller that skipped the outer pre-check and instead
    // followed the OLD docblock's literal wording — "returns null ⇒ caller
    // should prepend a fresh header instead" — would double the header, even
    // though injectCssComment()'s OWN internal guard also fires here (it
    // returns null too, just for the "already has it" reason, not the
    // "nothing to inject into" reason the old wording implied). This is
    // exactly the hazard finding 1 flagged (measured: 1 @copyright in, 2
    // out); it is not itself a regression guard — no shipped caller ever
    // composed it this way — but it proves the corrected docblock's warning
    // is not hypothetical.
    const naiveResult = injectCssComment(input) ?? prependCssComment(input);
    const naiveOccurrences = (naiveResult.match(/@copyright/g) || []).length;
    expect(naiveOccurrences).toBe(2);

    // For the REAL composition: since it returned null (no write), the file
    // on disk is left exactly as-is — still carrying exactly one
    // @copyright, never two.
    const effectiveContent = result ?? input;
    const occurrences = (effectiveContent.match(/@copyright/g) || []).length;
    expect(occurrences).toBe(1);
  });

  // REGRESSION (pre-existing) — pins the "any CRLF anywhere in the whole
  // input" rule crFor() implements (see its comment, corrected for round-2
  // review finding 2, which is NOT "detect and use the dominant terminator").
  // This exact mixed-EOL shape (3 bare LF, 1 CRLF) was previously untested.
  // Discriminates against BOTH origin/master and the first-cut fix
  // (7cb90da): neither ever attempted EOL preservation at all, so both
  // inject a bare-LF line here instead of adopting CRLF (measured: `expected
  // 1 to be 2` against each) — round-3 review, finding 1.
  it('mixed-EOL input: the injected line adopts CRLF because one is present ANYWHERE, not because it is dominant', () => {
    const input = '/**\n * hdr\r\n */\n:root{ --x: 1; }\n';

    const result = injectCssComment(input);

    const crlfCount = (result.match(/\r\n/g) || []).length;
    const totalNewlines = (result.match(/\n/g) || []).length;
    // Input: 3 bare LF + 1 CRLF. Output: 3 bare LF + 2 CRLF — the injected
    // line takes CRLF too, even though the very next line (the closer `*/`)
    // stays LF. Pins the exact behaviour crFor()'s corrected comment
    // describes; not itself a defect fix.
    expect(crlfCount).toBe(2);
    expect(totalNewlines - crlfCount).toBe(3);
    expect(result).toContain('@copyright');
    // Nothing was destroyed: the selector and declaration survive intact.
    expect(result).toContain(':root{ --x: 1; }');
  });

  // REGRESSION (pre-existing) — before the fix (round-2 review, finding 8),
  // prependCssComment() emitted its header IN FRONT OF a leading UTF-8 BOM,
  // leaving the BOM sitting mid-file right before `:root`, which a CSS
  // parser then reads as part of the selector, silently dropping the rule.
  // Byte-identical to master, so pre-existing with zero exposure today (no
  // BOM'd CSS ships in this repo).
  it('keeps a leading BOM at the very start of the file, not before the injected header', () => {
    const BOM = '﻿';
    const input = BOM + [':root { --x: 1; }', ''].join('\n');

    const result = process_(input);

    // The BOM must be byte 0 of the OUTPUT, and appear nowhere else — that
    // is the only position at which a CSS parser treats it as a BOM rather
    // than a stray character glued onto the next token.
    expect(result.charCodeAt(0)).toBe(0xfeff);
    expect(result.indexOf(BOM, 1)).toBe(-1);

    // Minimal, dependency-free APPROXIMATION of what a CSS parser sees as the
    // first selector — not a re-creation of one (no notion of strings,
    // escapes or at-rules): strip the leading BOM, then any leading
    // whitespace and comments, then read the next token. The whitespace
    // strip uses a class that explicitly EXCLUDES U+FEFF, unlike bare `\s`
    // (which, per ECMA-262, treats U+FEFF as whitespace and would silently
    // swallow a stray, non-leading BOM — exactly the axis this test exists
    // to guard; round-3 review, finding 3). That is not the only divergence
    // between JS `\s` and CSS whitespace this approximation is exposed to —
    // more generally, JS `\s` still matches characters postcss does not
    // treat as CSS whitespace at all: measured, `'\f\v:root{…}'` emulates
    // clean and postcss also reports the selector as exactly ":root" (no
    // divergence there), but `' :root{…}'` (leading U+00A0) emulates clean
    // while postcss reports the selector as " :root" (the NBSP is part of
    // the selector, not stripped) — a real divergence. Nothing asserted by
    // this test is false, since neither shape is fed to it; noted here only
    // so the disclaimer names the class this test's own EXCLUDES-U+FEFF fix
    // is one instance of, not the whole of it. Cross-checked against
    // postcss.parse() during review: on this fixed-up input postcss reports
    // the first rule's selector as exactly ":root"; on the pre-fix damage
    // shape (BOM glued to `:root`, not at byte 0) it reports "U+FEFF:root"
    // instead — a different, unmatchable selector, i.e. the rule silently
    // vanishes. A bare-`\s` version of this loop cannot tell the two shapes
    // apart (it strips the stray BOM too and reports both as "clean"); the
    // FEFF-excluding version below can, and does — see the second check
    // right after.
    const stripLeadingWhitespaceAndComments = (s) => {
      let r = s;
      let prev;
      do {
        prev = r;
        r = r.replace(/^(?:(?!\uFEFF)\s)+/, '').replace(/^\/\*[\s\S]*?\*\//, '');
      } while (r !== prev);
      return r;
    };

    const rest = stripLeadingWhitespaceAndComments(result.slice(BOM.length));
    expect(rest.startsWith(':root')).toBe(true);

    // Prove the emulation actually diverges on the guarded axis: fed the
    // damage shape directly (a BOM glued to `:root`, not at byte 0 — what
    // the pre-fix prependCssComment() used to produce), it must NOT report
    // "clean". A bare-`\s` version silently strips the BOM here and reports
    // startsWith(':root') === true even though postcss.parse() reports the
    // selector as "U+FEFF:root" — a false negative on exactly the shape this
    // file exists to catch.
    const damageShape = '/* hdr */\n' + BOM + ':root { --x: 1; }\n';
    const damageRest = stripLeadingWhitespaceAndComments(damageShape);
    expect(damageRest.startsWith(BOM)).toBe(true);
    expect(damageRest.startsWith(':root')).toBe(false);
  });
});

describe('prependTsDocblock (TS/JS copyright injection — BOM handling)', () => {
  // REGRESSION (pre-existing) — same category and same root cause as the CSS
  // BOM case above (round-2 review, finding 8; here, round-3 review,
  // finding 5): prependTsDocblock() used to emit its fresh docblock IN FRONT
  // OF a leading UTF-8 BOM, leaving the BOM sitting mid-file, in front of the
  // first real statement instead of at byte 0. Fails identically against
  // BOTH origin/master and the first-cut fix (7cb90da) — neither ever had
  // BOM-awareness in this function, so both relocate the BOM the same way
  // (measured: charCodeAt(0) === 0x2f, BOM re-appearing at a non-zero
  // index). Kept LOW: U+FEFF is ECMAScript WhiteSpace, so a relocated BOM
  // here is benign to `tsc`/node — unlike the CSS case, where it joins the
  // following selector and silently drops the rule — but it is the same bug
  // in the same function family, fixed for consistency.
  it('keeps a leading BOM at byte 0, with the docblock landing after it', () => {
    const BOM = '﻿';
    const input = BOM + 'export const x = 1;\n';

    const result = prependTsDocblock(input);

    // The BOM must be byte 0 of the OUTPUT, and appear nowhere else.
    expect(result.charCodeAt(0)).toBe(0xfeff);
    expect(result.indexOf(BOM, 1)).toBe(-1);
    expect((result.match(new RegExp(BOM, 'g')) || []).length).toBe(1);

    // The docblock (with the copyright line) follows the BOM, and the
    // original statement survives untouched.
    expect(result.slice(BOM.length).startsWith('/**')).toBe(true);
    expect(result).toContain(COPYRIGHT);
    expect(result).toContain('export const x = 1;');
  });

  // REGRESSION (pre-existing) — same root cause and category as the case
  // above, but on the shebang path specifically, which the BOM fix changes
  // the most: pre-fix, `isShebang(BOM + '#!...')` returned false (the leading
  // BOM defeats `startsWith('#!')`), so the fresh docblock was spliced in at
  // index 0 — IN FRONT of the shebang line — demoting the shebang off line 0
  // entirely (a shebang is honoured by the OS/`env` only at byte 0 of the
  // file). Post-fix the BOM is stripped before the shebang check runs, so the
  // shebang keeps line 0 (right after the BOM) and the docblock lands after
  // it, matching this function's own "prepend ... after any shebang"
  // contract. Fails identically against BOTH origin/master and the
  // first-cut fix (7cb90da): neither ever stripped the BOM before checking
  // for a shebang.
  it('keeps a shebang at line 0 when a leading BOM is present, with the docblock landing after both', () => {
    const BOM = '﻿';
    const input = BOM + '#!/usr/bin/env node\nexport const x = 1;\n';

    const result = prependTsDocblock(input);

    // The BOM must be byte 0 of the OUTPUT, and appear nowhere else.
    expect(result.charCodeAt(0)).toBe(0xfeff);
    expect(result.indexOf(BOM, 1)).toBe(-1);

    // The shebang is the very next line after the BOM — not demoted by the
    // docblock landing in front of it.
    expect(result.slice(BOM.length).split('\n')[0]).toBe('#!/usr/bin/env node');

    // The docblock (and the copyright line inside it) follows the shebang,
    // not the reverse, and the original statement survives untouched.
    const shebangIdx = result.indexOf('#!/usr/bin/env node');
    const docblockIdx = result.indexOf('/**');
    expect(docblockIdx).toBeGreaterThan(shebangIdx);
    expect(result).toContain(COPYRIGHT);
    expect(result).toContain('export const x = 1;');
  });
});
