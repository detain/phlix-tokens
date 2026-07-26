#!/usr/bin/env node
/**
 * add-copyright.mjs - Idempotent copyright-header injector for phlix-tokens.
 * Re-run produces zero diff when all files already have the header.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const COPYRIGHT = ' * @copyright 2026 Joe Huss <detain@interserver.net>';

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'vendor', '.git', 'coverage', '.github']);
const EXCLUDE_FILES = new Set(['tokens.generated.ts', 'tokens.generated.json']);
const TS_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const CSS_EXT = '.css';

function walk(dir, exts, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walk(full, exts, files);
    } else {
      const ext = extname(entry.name);
      const base = basename(entry.name);
      if (exts.has(ext) && !EXCLUDE_FILES.has(base)) {
        files.push(full);
      }
    }
  }
  return files;
}

function isShebang(line) {
  return line.startsWith('#!');
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
  if (block.includes('detain@interserver.net')) return null;

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
function prependTsDocblock(content) {
  const lines = content.split('\n');
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

  return [...lines.slice(0, offset), ...docblock, ...lines.slice(offset)].join('\n');
}

function processTsFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  if (content.includes('detain@interserver.net')) return null;
  return injectTsDocblock(content) ?? prependTsDocblock(content);
}

// Inject copyright into the file's OWN opening CSS block comment.
//
// Finds the terminator of the OPENING block comment — the FIRST line
// (scanning from the top of the file, since the opening comment always
// starts on line 0) that contains the block closer `*/` — and inserts the
// copyright line just before it, so it stays inside that block.
//
// Deliberately NOT the last `*/` in the whole file: CSS token files are
// full of later `/* ... */` annotation comments (including single-line
// trailing comments on individual declarations, e.g.
// `--radius-xl: 20px; /* filter bar, player, panels */`), so scanning for
// the last occurrence lands the copyright line on whatever later comment
// happens to close last — inside a `:root{}` block, between two
// declarations, as a naked, delimiter-less line. That corrupted 5 CSS
// files in commit 9ec4298 (fixed in #9); see the worklog for detail.
function injectCssComment(content) {
  const lines = content.split('\n');
  if (lines.length === 0 || !lines[0].trim().startsWith('/*')) return null;

  // Find the first line (starting at the opening line itself, since a
  // single-line opening comment like `/* */` closes on line 0) that
  // contains the block closer */.
  let closeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('*/')) {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) return null;

  // Check if copyright already present within the opening block
  const block = lines.slice(0, closeIdx + 1).join('\n');
  if (block.includes('detain@interserver.net')) return null;

  const out = [...lines];

  if (closeIdx === 0) {
    // Single-line opening comment (e.g. `/* */`) — there's no separate
    // line to insert before, so expand it into a multi-line block:
    // whatever preceded `*/` becomes its own line, then the copyright
    // line, then the closer.
    const line = lines[0];
    const closeAt = line.indexOf('*/');
    const before = line.slice(0, closeAt).trimEnd();
    const after = line.slice(closeAt); // '*/' plus anything trailing
    out.splice(0, 1, before, COPYRIGHT, ' ' + after);
  } else {
    // Multi-line opening comment — insert copyright just before the
    // closing line so it stays inside the block.
    out.splice(closeIdx, 0, COPYRIGHT);
  }

  return out.join('\n');
}

// Prepend a new CSS block comment at the top.
function prependCssComment(content) {
  const block = ['/*', COPYRIGHT, ' */', '', ''].join('\n');
  return block + '\n' + content;
}

function processCssFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  if (content.includes('detain@interserver.net')) return null;
  return injectCssComment(content) ?? prependCssComment(content);
}

// ---- Main ----
// Guarded so importing this module (e.g. from a test that exercises the
// pure functions below) never walks the repo tree and writes files —
// only running it directly as a script (`node scripts/add-copyright.mjs`)
// does.
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const tsFiles = [...walk('src', TS_EXTS), ...walk('test', TS_EXTS)];
  const cssFiles = walk('src', new Set([CSS_EXT]));

  let changed = 0;
  const touched = [];

  for (const file of [...tsFiles, ...cssFiles]) {
    const ext = extname(file);
    let newContent = null;

    if (TS_EXTS.has(ext)) newContent = processTsFile(file);
    else if (ext === CSS_EXT) newContent = processCssFile(file);

    if (newContent !== null) {
      writeFileSync(file, newContent, 'utf8');
      changed++;
      touched.push(file);
      console.log('ADDED: ' + file);
    } else {
      console.log('SKIP:  ' + file);
    }
  }

  console.log(`\nDone: ${changed} file(s) updated.`);
  if (touched.length > 0) {
    console.log('\nTouched:');
    for (const f of touched) console.log('  ' + f);
  }
}

// ---- Exports (for the regression test; the CLI usage above is unaffected) ----
export { injectCssComment, prependCssComment, injectTsDocblock, prependTsDocblock, COPYRIGHT };
