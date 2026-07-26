/**
 * copyright.mjs — the pure header-manipulation helpers used by
 * scripts/add-copyright.mjs.
 *
 * This module is side-effect free BY CONSTRUCTION: it reads no files, writes no
 * files and walks no directories. That is the whole point of the split.
 * Previously these functions lived in scripts/add-copyright.mjs alongside the
 * file-walking "main" section, which therefore had to be fenced off behind an
 *   import.meta.url === pathToFileURL(process.argv[1]).href
 * guard so that importing the module (from the regression test) did not rewrite
 * the repo. That guard is a silent-failure trap: pathToFileURL() does NOT
 * resolve symlinks while import.meta.url IS the resolved realpath, so invoking
 * the script through a symlink (or through a symlinked path component, or via a
 * package.json `bin` shim) made the guard false and the whole run a zero-output,
 * exit-0 no-op. With the pure code in its own module the CLI needs no guard at
 * all, so there is no guard left to be wrong.
 *
 * Header note (round-2 review, finding 5): this is the only file under
 * scripts/ carrying a @copyright line — its four siblings (add-copyright.mjs,
 * generate-tokens.mjs, generate-tokens.d.mts, build-css.mjs) have none, and
 * `npm run copyright`'s walk() only covers src/ and test/, so nothing
 * enforces either state. That asymmetry is deliberate, not an oversight: this
 * file is kept IN SYNC BY HAND. Do not extend walk() to scripts/ to "fix"
 * this — that changes CLI behaviour (it would start rewriting scripts/*.mjs).
 * There is no separate ticket tracking this: it is a one-off decision made
 * here, not a deferred piece of work.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

const COPYRIGHT = ' * @copyright 2026 Joe Huss <detain@interserver.net>';

// The substring that marks a file as already carrying the header.
const MARKER = 'detain@interserver.net';

function isShebang(line) {
  return line.startsWith('#!');
}

// Return the carriage return that has to be appended to any line WE inject,
// so an injected line does not end up LF-terminated inside an otherwise CRLF
// file. `content.split('\n')` leaves the '\r' at the end of each original
// line, so re-joining with '\n' reproduces CRLF for untouched lines — only
// injected lines need this.
//
// The rule is "any CRLF anywhere in the whole input", NOT "the dominant
// terminator" — there is no counting or majority vote. A single '\r\n'
// anywhere in an otherwise all-LF file is enough to make the injected line
// CRLF too, regardless of what its immediate neighbour lines use. On a
// genuinely mixed-EOL input (rare, and not something this repo's own CSS
// ever produces) that can leave the injected line's terminator matching
// neither the line before nor the line after it: e.g. for
// `"/**\n * hdr\r\n */\n:root{…}\n"` (3 bare LF, 1 CRLF, and the CRLF line
// happens to immediately precede the insertion point) the output has 3 bare
// LF + 2 CRLF — the injected line is CRLF even though the line that follows
// it (the closing ` */`) stays LF. That is intentional-by-omission
// (simplicity over a rare edge case), not a bug to silently "improve" here —
// see the mixed-EOL test below, which pins this exact behaviour.
function crFor(content) {
  return content.includes('\r\n') ? '\r' : '';
}

// Find the line index (0-based) where a TS/JS docblock ends (contains star-slash)
function findDocblockEnd(lines, start) {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes('*/')) return i;
  }
  return -1;
}

// Inject copyright into an existing TS/JS docblock /** ... */
// Returns null if no top-level docblock OR copyright already present.
// Only considers /** at the very start of the file (after optional shebang)
// to avoid misinterpreting TypeScript type expressions like `TokenTarget & { */ }`.
function injectTsDocblock(content) {
  const lines = content.split('\n');

  let offset = 0;
  if (lines.length > 0 && isShebang(lines[0])) offset = 1;

  // Only consider /** that appears at the very start of the file (after shebang)
  if (lines.length <= offset || !lines[offset].includes('/**')) return null;

  const docStart = offset;
  const docEnd = findDocblockEnd(lines, docStart);
  if (docEnd === -1) return null;

  const block = lines.slice(docStart, docEnd + 1).join('\n');
  if (block.includes(MARKER)) return null;

  // Find the best insertion point: after the last non-empty, non-marker content line
  let insertAfter = docStart + 1;
  for (let i = docStart + 1; i < docEnd; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed === '*/' || trimmed.startsWith('* @')) break;
    insertAfter = i;
  }

  const out = [...lines];
  out.splice(insertAfter + 1, 0, COPYRIGHT);
  return out.join('\n');
}

// Prepend a new TS/JS docblock at the top (after any shebang).
//
// Round-3 review, finding 5: the same BOM-relocation bug fixed in
// prependCssComment() (round-2 review, finding 8) also existed here — if
// `content` starts with a BOM, the header must still land AFTER it, not
// before. U+FEFF is ECMAScript WhiteSpace, so a relocated BOM here is benign
// to `tsc`/node (unlike the CSS case, where it joins the following selector
// and silently drops the rule) — but leaving one path fixed and the other
// not is an inconsistency in the same function family, so it is fixed here
// too. `injectTsDocblock()` below does NOT have this defect: it only splices
// a new line into the array and never touches line 0, so a leading BOM
// already stays exactly where it was.
function prependTsDocblock(content) {
  const hasBom = content.startsWith(BOM);
  const body = hasBom ? content.slice(BOM.length) : content;

  const lines = body.split('\n');
  let offset = 0;
  if (lines.length > 0 && isShebang(lines[0])) offset = 1;

  const docblock = [
    '/**',
    ' * Design token exports and theme resolution utilities.',
    ' *',
    COPYRIGHT,
    ' */',
    '',
  ];

  return (hasBom ? BOM : '') + [...lines.slice(0, offset), ...docblock, ...lines.slice(offset)].join('\n');
}

// Inject copyright into the file's OWN opening CSS block comment.
//
// Finds the terminator of the OPENING block comment — the FIRST `*/` at or
// after the opening `/*` (scanning from the top of the file, since the opening
// comment always starts on line 0) — and inserts the copyright line just
// before it, so it stays inside that block.
//
// Deliberately NOT the last `*/` in the whole file: CSS token files are
// full of later `/* ... */` annotation comments (including single-line
// trailing comments on individual declarations, e.g.
// `--radius-xl: 20px; /* filter bar, player, panels */`), so scanning for
// the last occurrence lands the copyright line on whatever later comment
// happens to close last — inside a `:root{}` block, between two
// declarations, as a naked, delimiter-less line. That corrupted 5 CSS
// files in commit 9ec4298 (fixed in #9); see the worklog for detail.
//
// Returns null for TWO DIFFERENT reasons that a caller MUST NOT treat the
// same way (round-2 review, finding 1 — a caller that conflates them can
// double the header: measured 1 @copyright in, 2 out):
//
//   1. NOTHING TO INJECT INTO: line 0 does not open a block comment, or that
//      opening block comment is never terminated. The content has no
//      existing header near the top, so the caller MAY safely prepend a
//      fresh one via prependCssComment().
//
//   2. ALREADY HAS THE HEADER: the content carries the marker ANYWHERE (not
//      just inside the opening comment — see the "refuses a file whose
//      existing copyright sits outside the opening block" test), checked
//      before any comment-shape reasoning even runs. The caller MUST do
//      NOTHING. Calling prependCssComment() here produces a SECOND header.
//
// Both reasons collapse to the same bare `null`, so the return value alone
// cannot tell a caller which one happened. That is why every caller in this
// repo (scripts/add-copyright.mjs::processCssFile, and this file's own test
// helper) checks `content.includes(MARKER)` FIRST, BEFORE ever calling
// injectCssComment, and only runs `injectCssComment(content) ??
// prependCssComment(content)` when that check is false. If you add a new
// caller: keep that outer pre-check. Do not compose
// `injectCssComment(x) ?? prependCssComment(x)` without it — on a
// marker-carrying file that composition prepends a second header on top of
// the first one, unconditionally, every time.
function injectCssComment(content) {
  // Whole-content duplicate guard, so this function is safe to call standalone
  // and not just via a caller that pre-checks (processCssFile does pre-check,
  // but the function is exported, so its own guard must not be narrower than
  // the file it is handed).
  if (content.includes(MARKER)) return null;

  const lines = content.split('\n');
  if (lines.length === 0 || !lines[0].trim().startsWith('/*')) return null;

  const openAt = lines[0].indexOf('/*');

  // Find the terminator of the opening block comment: the first `*/` at or
  // after `openAt + 2`. Starting the scan past the opening delimiter matters
  // for a degenerate first line like `/*/`, where the `*` is SHARED between
  // the opener and the apparent closer — `'/*/'.indexOf('*/') === 1`, so a
  // naive scan would "close" the comment on top of its own opener and split
  // the line into a bare `/`, destroying a source character. There is no
  // terminator there, so we keep scanning (and, absent one, return null and
  // let the caller prepend a valid header, leaving the input intact).
  let closeIdx = -1;
  let closeAt = -1;
  for (let i = 0; i < lines.length; i++) {
    const from = i === 0 ? openAt + 2 : 0;
    const at = lines[i].indexOf('*/', from);
    if (at !== -1) {
      closeIdx = i;
      closeAt = at;
      break;
    }
  }
  if (closeIdx === -1) return null;

  const cr = crFor(content);
  const out = [...lines];

  if (closeIdx === 0) {
    // Single-line opening comment (e.g. `/* */`) — there's no separate
    // line to insert before, so expand it into a multi-line block:
    // whatever preceded `*/` becomes its own line, then the copyright
    // line, then the closer.
    const line = lines[0];
    const before = line.slice(0, closeAt).trimEnd();
    const after = line.slice(closeAt); // '*/' plus anything trailing
    out.splice(0, 1, before + cr, COPYRIGHT + cr, ' ' + after);
  } else {
    // Multi-line opening comment — insert copyright just before the
    // closing line so it stays inside the block.
    out.splice(closeIdx, 0, COPYRIGHT + cr);
  }

  return out.join('\n');
}

// A leading UTF-8 BOM (U+FEFF) is only recognised as a BOM by CSS parsers
// (postcss included) when it is the very first three bytes of the file.
const BOM = '﻿';

// Prepend a new CSS block comment at the top.
//
// Round-2 review, finding 8: if `content` starts with a BOM, the header must
// still land AFTER it, not before — prepending in front of the BOM leaves it
// sitting mid-file, in front of `:root` instead of in front of the file, and
// postcss then parses the next rule's selector as the literal string
// "U+FEFF:root" instead of ":root", silently dropping the whole rule.
// Pre-existing (byte-identical to master here), zero exposure today (no
// BOM'd CSS in this repo), fixed while touching this file anyway.
function prependCssComment(content) {
  const hasBom = content.startsWith(BOM);
  const body = hasBom ? content.slice(BOM.length) : content;
  const eol = crFor(body) + '\n';
  const block = ['/*', COPYRIGHT, ' */', '', ''].join(eol);
  return (hasBom ? BOM : '') + block + eol + body;
}

export { injectCssComment, prependCssComment, injectTsDocblock, prependTsDocblock, COPYRIGHT, MARKER };
