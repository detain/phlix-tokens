#!/usr/bin/env node
/**
 * generate-token-reference.mjs — CLI half: read the committed generated map
 * (src/tokens.generated.json) and write the human-facing token reference
 * (docs/token-reference.md). Deterministic, no network, re-runnable.
 *
 * Usage: `npm run generate:reference` (or `node scripts/generate-token-reference.mjs`).
 * Run it AFTER `npm run generate` when src/css changed — this document is
 * derived from the generated artifact, so regenerating both keeps the doc in
 * lockstep with dist/tokens.json by construction.
 *
 * Same doctrine as generate-tokens.mjs, deliberately NO main-guard (a
 * pathToFileURL(import.meta.url)/argv comparison silently misfires through
 * symlinks and turns the run into an exit-0 no-op; see generate-tokens.mjs's
 * header and the guard test over every script under `scripts/`).
 * "Wrote nothing" cannot exit 0:
 * the pure renderer fails loud on a vacuous map, and the file is read back and
 * byte-compared after writing.
 *
 * The pure rendering logic lives in ./lib/token-reference.mjs so it can be
 * unit-tested without importing (and therefore running) this file.
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

import { renderReference, distinctPropertyCount } from './lib/token-reference.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_JSON = join(__dirname, '..', 'src', 'tokens.generated.json');
const OUT_MD = join(__dirname, '..', 'docs', 'token-reference.md');

// Fail closed: the reference doc is derivative of the token artifact, and CI's
// generated-artifact gate is the chain-of-trust for src/ → json. A missing
// json here means the run order was violated or the tree is broken.
let parsed;
try {
  parsed = JSON.parse(readFileSync(SRC_JSON, 'utf8'));
} catch (err) {
  throw new Error(
    `generate-token-reference: cannot read+parse ${SRC_JSON} (${err.message}) — run \`npm run generate\` first.`,
  );
}

const md = renderReference(parsed.tokens);
mkdirSync(dirname(OUT_MD), { recursive: true });
writeFileSync(OUT_MD, md);

const actual = readFileSync(OUT_MD, 'utf8');
if (actual !== md) {
  throw new Error(
    `generate-token-reference: wrote ${OUT_MD} (${Buffer.byteLength(md)} bytes) but reading it back ` +
      `gave ${Buffer.byteLength(actual)} bytes that do not match — refusing to report success on an ` +
      `artifact that did not land on disk.`,
  );
}

console.log(
  `generated ${OUT_MD} — ${distinctPropertyCount(parsed.tokens)} distinct custom properties`,
);
