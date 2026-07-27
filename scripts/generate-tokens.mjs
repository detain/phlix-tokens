#!/usr/bin/env node
/**
 * generate-tokens.mjs — parse src/css/*.css, extract every `--var: value;`
 * grouped by selector, resolve `var(--ref)` chains within a theme, and write
 * src/tokens.generated.ts (+ .json). Deterministic, no network, re-runnable.
 *
 * Usage: `npm run generate` (or `node scripts/generate-tokens.mjs`).
 *
 * This file is the CLI half only: listing src/css, reading, rendering, writing,
 * verifying and reporting. All of the pure token-model logic (CSS parsing,
 * `var()` resolution, family partitioning, the vacuity assertions and both
 * renderers) lives in ./lib/tokens.mjs so it can be unit-tested without
 * importing this file. That is why there is deliberately NO
 * `import.meta.url === pathToFileURL(process.argv[1]).href` main-guard here:
 * importing the library can never write a file, and such a guard silently
 * evaluates false whenever the script is reached through a symlink
 * (`pathToFileURL` does not resolve symlinks, `import.meta.url` is the
 * realpath), which turns the entire run into a zero-output, exit-0 no-op.
 *
 * That no-op was not merely cosmetic: .github/workflows/ci.yml runs
 * `npm run generate` and then `git diff --exit-code` on the committed
 * artifacts, so a generator that writes nothing makes the gate compare the
 * committed artifact against ITSELF and pass vacuously. Two things keep that
 * from recurring: no guard exists to be wrong, and this script now PROVES it
 * did work — `assertNonVacuous()` rejects an empty token model, and each output
 * is read back and byte-compared after writing, so "wrote nothing" can only
 * ever exit non-zero.
 *
 * See ./lib/tokens.mjs for the selector model and the token-family mapping.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// Imported explicitly rather than used as a global: eslint.config.js declares
// only `console` and `process` as globals for scripts/**/*.mjs.
import { Buffer } from 'node:buffer';

import {
  THEME_NAMES,
  buildTokens,
  assertNonVacuous,
  renderJson,
  renderTs,
} from './lib/tokens.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_DIR = join(__dirname, '..', 'src', 'css');
const OUT_TS = join(__dirname, '..', 'src', 'tokens.generated.ts');
const OUT_JSON = join(__dirname, '..', 'src', 'tokens.generated.json');

const names = readdirSync(CSS_DIR)
  .filter((f) => f.endsWith('.css'))
  .sort(); // deterministic order

// Fail closed on an empty/unexpected source dir rather than writing two empty
// artifacts and exiting 0 (which CI's diff gate cannot distinguish from a
// legitimate no-op run).
if (names.length === 0) {
  throw new Error(
    `generate-tokens: found no *.css files in ${CSS_DIR} — refusing to write an empty ` +
      `token artifact and report success.`,
  );
}

const built = buildTokens(
  names.map((name) => ({ name, css: readFileSync(join(CSS_DIR, name), 'utf8') })),
);
assertNonVacuous(built);

const json = renderJson(built);
const ts = renderTs(built);

writeFileSync(OUT_JSON, json);
writeFileSync(OUT_TS, ts);

// Read both artifacts back and byte-compare. This is the last link in the
// "prove it did work" chain: everything above can be correct and the process
// can still have produced no durable output (a read-only mount, a sandbox that
// swallows the write, an OS-level path jail). Reporting success without
// confirming the bytes landed is precisely the failure mode this whole change
// exists to remove.
for (const [path, expected] of [
  [OUT_JSON, json],
  [OUT_TS, ts],
]) {
  const actual = readFileSync(path, 'utf8');
  if (actual !== expected) {
    // Buffer.byteLength, not String.length: the rendered output contains
    // multi-byte characters (em dashes, `∪`), and String.length counts UTF-16
    // code units, so it is not a byte count. This message exists to be read by a
    // human diagnosing a write that did not land, so the number has to be the
    // one they would see from `wc -c`/`ls -l`.
    throw new Error(
      `generate-tokens: wrote ${path} (${Buffer.byteLength(expected)} bytes) but reading it ` +
        `back returned ${Buffer.byteLength(actual)} bytes that do not match — refusing to ` +
        `report success on an artifact that did not land on disk.`,
    );
  }
}

console.log(
  `generated ${OUT_TS} and ${OUT_JSON} — base:${Object.keys(built.tokens.base).length} ` +
    THEME_NAMES.map((t) => `${t}:${Object.keys(built.tokens[t]).length}`).join(' '),
);
