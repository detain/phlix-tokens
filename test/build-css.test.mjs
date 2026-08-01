/**
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// Tests for scripts/build-css.mjs — the CSS artifact builder.
//
// The script uses __dirname-relative paths so it ALWAYS writes to the real
// repo's dist/ directory. This test runs against the real tree and verifies
// the output artifacts are produced and well-formed.
//
// NOT covered by v8 subprocess coverage (CLI entry points run in child
// processes invisible to the parent process's v8 counters) — this is expected
// and intentional. See vite.config.ts coverage config comment.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_CSS_SCRIPT = join(REPO, 'scripts', 'build-css.mjs');
const DIST = join(REPO, 'dist');
const DIST_CSS = join(DIST, 'css');

// Save the original dist/ state before any test touches it, so we can restore
// after the group.  build-css.mjs overwrites these three things:
//   dist/style.css
//   dist/tokens.json
//   dist/css/*.css
// The rest of dist/ (phlix-tokens.js, phlix-tokens.umd.cjs, etc.) is produced
// by `vite build` and is NOT touched by build-css.mjs.
const backup = {};

beforeAll(() => {
  if (!existsSync(DIST)) return;
  for (const rel of ['style.css', 'tokens.json']) {
    const full = join(DIST, rel);
    backup[rel] = existsSync(full) ? readFileSync(full, 'utf8') : null;
  }
  if (existsSync(DIST_CSS)) {
    for (const f of readdirSync(DIST_CSS)) {
      backup['css/' + f] = readFileSync(join(DIST_CSS, f), 'utf8');
    }
  }
});

afterAll(() => {
  for (const [rel, data] of Object.entries(backup)) {
    const full = join(DIST, rel);
    if (data === null) {
      rmSync(full, { recursive: true, force: true });
    } else {
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, data);
    }
  }
});

describe('build-css CLI', () => {
  it('emits a descriptive stdout line when run against the real tree', () => {
    const r = spawnSync(process.execPath, [BUILD_CSS_SCRIPT], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/built dist\/style\.css \+ dist\/tokens\.json/);
  });

  it('writes dist/style.css with inlined @imports from index.css', () => {
    spawnSync(process.execPath, [BUILD_CSS_SCRIPT], { encoding: 'utf8' });
    expect(existsSync(join(DIST, 'style.css'))).toBe(true);
    const style = readFileSync(join(DIST, 'style.css'), 'utf8');
    expect(style).toMatch(/\/\* ---- inlined: .*\.css ---- \*\//);
  });

  it('copies each src/css/*.css file verbatim to dist/css/', () => {
    spawnSync(process.execPath, [BUILD_CSS_SCRIPT], { encoding: 'utf8' });
    expect(existsSync(join(DIST_CSS, 'colors.css'))).toBe(true);
    const src = readFileSync(join(REPO, 'src', 'css', 'colors.css'), 'utf8');
    const dist = readFileSync(join(DIST_CSS, 'colors.css'), 'utf8');
    expect(dist).toBe(src);
  });

  it('copies src/tokens.generated.json to dist/tokens.json', () => {
    spawnSync(process.execPath, [BUILD_CSS_SCRIPT], { encoding: 'utf8' });
    expect(existsSync(join(DIST, 'tokens.json'))).toBe(true);
    const src = readFileSync(join(REPO, 'src', 'tokens.generated.json'), 'utf8');
    const dist = readFileSync(join(DIST, 'tokens.json'), 'utf8');
    expect(dist).toBe(src);
  });
});
