#!/usr/bin/env node
/**
 * build-css.mjs — produce the shipped CSS artifacts in dist/:
 *   · dist/css/*.css          ← every src/css file copied verbatim (so the
 *                               `@phlix/tokens/css/*` export resolves)
 *   · dist/style.css          ← a SELF-CONTAINED stylesheet: index.css with its
 *                               relative @import lines inlined, in index order,
 *                               so `import '@phlix/tokens/style.css'` works
 *                               standalone with no further resolution.
 *
 * Deterministic, no network. Run as part of `npm run build`.
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_CSS = join(__dirname, '..', 'src', 'css');
const DIST = join(__dirname, '..', 'dist');
const DIST_CSS = join(DIST, 'css');

mkdirSync(DIST_CSS, { recursive: true });

// 1. Copy every css file verbatim into dist/css/.
const files = readdirSync(SRC_CSS).filter((f) => f.endsWith('.css'));
for (const f of files) {
  copyFileSync(join(SRC_CSS, f), join(DIST_CSS, f));
}

// 2. Build a self-contained dist/style.css by inlining index.css's @imports.
const indexSrc = readFileSync(join(SRC_CSS, 'index.css'), 'utf8');
const importRe = /@import\s+['"]\.\/([\w.-]+\.css)['"];?\s*/g;
const out = indexSrc.replace(importRe, (_m, rel) => {
  const body = readFileSync(join(SRC_CSS, rel), 'utf8');
  return `/* ---- inlined: ${rel} ---- */\n${body}\n`;
});
writeFileSync(join(DIST, 'style.css'), out);

 
console.log(`built dist/style.css + copied ${files.length} css files to dist/css/`);
