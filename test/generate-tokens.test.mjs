/**
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// Tests for scripts/generate-tokens.mjs — the WRITING CLI half. The pure token
// model it delegates to lives in scripts/lib/tokens.mjs and is covered by
// test/tokens.test.ts; nothing here imports either module, every case spawns the
// script as a real child process against a throwaway tree.
//
// Root cause of the defect these cases guard (fixed in the accompanying change):
// the script gated its main() on
//
//     if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
//
// `pathToFileURL()` does NOT resolve symlinks, but `import.meta.url` DOES (it is
// always the realpath). So whenever the script was reached through a symlinked
// file, a symlinked directory component, or a package `bin` shim, the two hrefs
// differed, the guard was false, and the process exited 0 having written zero
// bytes — a silent no-op indistinguishable from success.
//
// Why that was worse than an ordinary bug: .github/workflows/ci.yml runs
// `npm run generate` and then `git diff --exit-code -- src/tokens.generated.ts
// src/tokens.generated.json`. A generator that produces nothing makes that gate
// compare the committed artifact against ITSELF, so the gate passed
// unconditionally — a CI gate that could not fail. That is how the 9ec4298 token
// corruption stayed green. The fix is therefore two-part and so are these tests:
// the guard is GONE (the pure half moved to scripts/lib/tokens.mjs, so the CLI
// never needed one), and the CLI now PROVES it did work — it rejects an empty
// token model and reads each artifact back byte-for-byte after writing.
//
// NOT every case below is a regression guard, and they are labelled so the
// distinction survives. Each label is derived from ONE measured signature — the
// result of running THIS test body against a80514c's scripts/generate-tokens.mjs
// (the pre-fix implementation, reconstructed with `git show`) versus against the
// current one. The two labels partition all cases exhaustively and disjointly,
// and every label is mechanically checkable by re-running that A/B, not a matter
// of judgement:
//
//   REGRESSION      — FAILS against a80514c, PASSES against the fix. A defect
//                     that actually shipped.
//   CHARACTERIZATION — PASSES against BOTH. Documents intended behaviour without
//                     discriminating between the implementations. Kept on
//                     purpose, but do not mistake it for a guard.
//
// Measured signature of this file against a80514c: `Tests 9 failed | 6 passed
// (15)`. (15 rather than 16 because the reconstructed tree has four `.mjs` files
// under scripts/ instead of five — it predates scripts/lib/tokens.mjs — so the
// parameterized guard table at the bottom yields one row fewer.) Against the fix:
// all 16 pass.
//
// To re-measure, point the two overrides below at a reconstructed tree:
//
//   git show a80514c:scripts/generate-tokens.mjs > /tmp/old/scripts/generate-tokens.mjs
//   PHLIX_TOKENS_GEN_SCRIPT=/tmp/old/scripts/generate-tokens.mjs \
//   PHLIX_TOKENS_SCRIPTS_DIR=/tmp/old/scripts npx vitest run test/generate-tokens.test.mjs
//
// The overrides exist ONLY for that measurement; unset (the normal case, and the
// only case CI ever runs) they resolve to this repo's own files.
//
// This is a plain Node .mjs test (not .ts) because the script under test is
// plain Node ESM and is outside the TypeScript project: tsconfig.json's
// `include` is ["src/**/*.ts", "src/**/*.d.ts", "test/**/*.ts",
// "scripts/**/*.d.mts"], none of which match a `.mjs` file, so `npm run
// typecheck` never sees it. It needs no ESLint carve-out either — it imports
// everything it uses (including `node:process`) and declares no Node globals.

import { describe, it, expect, afterAll } from 'vitest';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

const GEN_SCRIPT = process.env.PHLIX_TOKENS_GEN_SCRIPT ?? join(REPO, 'scripts', 'generate-tokens.mjs');
const SCRIPTS_DIR = process.env.PHLIX_TOKENS_SCRIPTS_DIR ?? join(REPO, 'scripts');

/** Every scratch tree made during this run, torn down in afterAll. */
const scratchRoots = [];

afterAll(() => {
  for (const root of scratchRoots) rmSync(root, { recursive: true, force: true });
});

/**
 * Build a throwaway tree shaped like the repo — scripts/generate-tokens.mjs,
 * scripts/lib/, src/css/ — so the script's `__dirname`-relative paths land
 * inside it and no test ever writes to the real src/tokens.generated.*.
 *
 * `css` is either 'real' (copy src/css verbatim) or a { filename: body } map.
 */
function makeScratch({ css = 'real' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'phlix-tokens-gen-'));
  scratchRoots.push(root);
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });

  cpSync(GEN_SCRIPT, join(root, 'scripts', 'generate-tokens.mjs'));
  // The CLI's pure half. Copied unconditionally: a reconstructed pre-split
  // script simply never imports it, which is harmless.
  if (existsSync(join(SCRIPTS_DIR, 'lib'))) {
    cpSync(join(SCRIPTS_DIR, 'lib'), join(root, 'scripts', 'lib'), { recursive: true });
  }

  if (css === 'real') {
    cpSync(join(REPO, 'src', 'css'), join(root, 'src', 'css'), { recursive: true });
  } else {
    mkdirSync(join(root, 'src', 'css'), { recursive: true });
    for (const [name, body] of Object.entries(css)) {
      writeFileSync(join(root, 'src', 'css', name), body, 'utf8');
    }
  }
  return root;
}

/** Run a node entry point and capture status + streams. */
function run(entry) {
  const r = spawnSync(process.execPath, [entry], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const tsOut = (root) => join(root, 'src', 'tokens.generated.ts');
const jsonOut = (root) => join(root, 'src', 'tokens.generated.json');

/** A minimal stylesheet set that satisfies every non-vacuity assertion. */
const MINIMAL_CSS = {
  'colors.css': ":root { --bg: #000; }\n[data-theme='nocturne'] { --bg: #000; }\n" +
    "[data-theme='daylight'] { --bg: #fff; }\n[data-theme='midnight'] { --bg: #111; }\n",
  'density.css': "[data-density='comfortable'] { --row-h: 3rem; }\n" +
    "[data-density='compact'] { --row-h: 2rem; }\n",
};

describe('generate-tokens CLI — invocation through a symlink', () => {
  // CHARACTERIZATION — a direct, non-symlinked invocation has always worked;
  // this is the control the two regression cases below are compared against.
  it('writes both artifacts when invoked by its real path', () => {
    const root = makeScratch();
    const r = run(join(root, 'scripts', 'generate-tokens.mjs'));

    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/^generated .* base:\d+ /);
    expect(existsSync(tsOut(root))).toBe(true);
    expect(existsSync(jsonOut(root))).toBe(true);
  });

  // REGRESSION — the shipped defect. `pathToFileURL(argv[1])` kept the symlink
  // path verbatim while `import.meta.url` was the realpath, so the main-guard
  // was false: exit 0, zero bytes of stdout, no files written.
  it('writes both artifacts when reached through a symlink to the SCRIPT', () => {
    const root = makeScratch();
    const alias = join(root, 'scripts', 'gen-alias.mjs');
    symlinkSync(join(root, 'scripts', 'generate-tokens.mjs'), alias);

    const r = run(alias);

    expect(r.status, r.stderr).toBe(0);
    // The single most diagnostic assertion: the pre-fix script printed NOTHING.
    expect(r.stdout.length).toBeGreaterThan(0);
    expect(r.stdout).toMatch(/^generated .* base:\d+ /);
    expect(existsSync(tsOut(root))).toBe(true);
    expect(existsSync(jsonOut(root))).toBe(true);
  });

  // REGRESSION — same defect via a symlinked DIRECTORY component rather than a
  // symlinked file. This is the shape a checkout under a symlinked path, an
  // `npm link`ed package or a node_modules/.bin shim actually takes.
  it('writes both artifacts when reached through a symlinked DIRECTORY component', () => {
    const root = makeScratch();
    const dirAlias = join(root, 'scripts-alias');
    symlinkSync(join(root, 'scripts'), dirAlias);

    const r = run(join(dirAlias, 'generate-tokens.mjs'));

    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
    expect(existsSync(tsOut(root))).toBe(true);
    expect(existsSync(jsonOut(root))).toBe(true);
  });

  // REGRESSION — byte-for-byte parity between the two invocation paths. A fix
  // that made the symlink path merely "produce something" would still be wrong;
  // the artifact must be identical to the real-path artifact.
  it('produces byte-identical output via a symlink and via the real path', () => {
    const direct = makeScratch();
    expect(run(join(direct, 'scripts', 'generate-tokens.mjs')).status).toBe(0);

    const linked = makeScratch();
    const alias = join(linked, 'scripts', 'gen-alias.mjs');
    symlinkSync(join(linked, 'scripts', 'generate-tokens.mjs'), alias);
    expect(run(alias).status).toBe(0);

    expect(readFileSync(tsOut(linked), 'utf8')).toBe(readFileSync(tsOut(direct), 'utf8'));
    expect(readFileSync(jsonOut(linked), 'utf8')).toBe(readFileSync(jsonOut(direct), 'utf8'));
  });
});

describe("generate-tokens CLI — CI's up-to-date gate must be able to fail", () => {
  // REGRESSION — this is the CI hole itself, encoded. CI does
  // `npm run generate` then `git diff --exit-code` on the committed artifacts.
  // Stand in a STALE artifact (the 9ec4298 scenario), regenerate through a
  // symlink, and require that the generator OVERWROTE it. Pre-fix the stale
  // bytes survived untouched, which is exactly what made `git diff --exit-code`
  // compare the committed artifact against itself and pass vacuously.
  it('overwrites a stale artifact when reached through a symlink', () => {
    const root = makeScratch();
    const stale = '/* STALE — not what src/css generates */\n';
    writeFileSync(tsOut(root), stale, 'utf8');
    writeFileSync(jsonOut(root), stale, 'utf8');

    const alias = join(root, 'scripts', 'gen-alias.mjs');
    symlinkSync(join(root, 'scripts', 'generate-tokens.mjs'), alias);
    const r = run(alias);

    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(tsOut(root), 'utf8')).not.toBe(stale);
    expect(readFileSync(jsonOut(root), 'utf8')).not.toBe(stale);
    // and the replacement is the real artifact, not just "different bytes"
    expect(readFileSync(tsOut(root), 'utf8')).toContain('export function resolveTheme');
    expect(JSON.parse(readFileSync(jsonOut(root), 'utf8'))).toHaveProperty('tokens.base');
  });
});

describe('generate-tokens CLI — a vacuous run must exit non-zero', () => {
  // REGRESSION — pre-fix the generator happily wrote two structurally valid but
  // all-empty artifacts and exited 0. Reporting success on zero tokens is the
  // same class of defect as the silent no-op: CI's diff gate cannot tell an
  // empty artifact from a legitimately unchanged one.
  it('fails when src/css contains no stylesheets at all', () => {
    const root = makeScratch({ css: {} });
    const r = run(join(root, 'scripts', 'generate-tokens.mjs'));

    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/found no \*\.css files/);
    expect(existsSync(tsOut(root))).toBe(false);
    expect(existsSync(jsonOut(root))).toBe(false);
  });

  // REGRESSION — stylesheets present but not a single `:root` custom property.
  it('fails when no :root tokens are parsed', () => {
    const root = makeScratch({ css: { 'colors.css': "[data-theme='nocturne'] { --bg: #000; }\n" } });
    const r = run(join(root, 'scripts', 'generate-tokens.mjs'));

    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/parsed 0 `:root` custom properties/);
    expect(existsSync(tsOut(root))).toBe(false);
  });

  // REGRESSION — a theme whose selector block has vanished from the CSS. The
  // generator's THEME_NAMES list is hardcoded, so this silently emitted
  // `tokens.midnight = {}` and every non-CSS consumer got an empty theme.
  it('fails when a declared theme resolves to zero tokens', () => {
    const css = { ...MINIMAL_CSS };
    css['colors.css'] = ":root { --bg: #000; }\n[data-theme='nocturne'] { --bg: #000; }\n" +
      "[data-theme='daylight'] { --bg: #fff; }\n"; // midnight removed
    const root = makeScratch({ css });
    const r = run(join(root, 'scripts', 'generate-tokens.mjs'));

    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/theme 'midnight' resolved to 0 tokens/);
    expect(existsSync(tsOut(root))).toBe(false);
  });

  // REGRESSION — same for a density variant.
  it('fails when a declared density variant resolves to zero tokens', () => {
    const css = { ...MINIMAL_CSS };
    css['density.css'] = "[data-density='comfortable'] { --row-h: 3rem; }\n"; // compact removed
    const root = makeScratch({ css });
    const r = run(join(root, 'scripts', 'generate-tokens.mjs'));

    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/density 'compact' resolved to 0 tokens/);
    expect(existsSync(tsOut(root))).toBe(false);
  });

  // CHARACTERIZATION — the non-vacuity assertions must not reject a legitimate
  // minimal token set. Guards against the fix over-shooting into a false
  // positive that would make `npm run generate` unusable.
  it('succeeds on a minimal but complete token set', () => {
    const root = makeScratch({ css: MINIMAL_CSS });
    const r = run(join(root, 'scripts', 'generate-tokens.mjs'));

    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(tsOut(root))).toBe(true);
    expect(existsSync(jsonOut(root))).toBe(true);
  });
});

describe('scripts/ carry no symlink-unsafe main-guard', () => {
  /**
   * Strip `/* … *\/` blocks and `// …` line comments so the scan only sees
   * executable code. Both scripts/add-copyright.mjs and scripts/lib/*.mjs
   * DESCRIBE the banned idiom in their header docblocks on purpose; a naive
   * substring search would flag those and make this test useless.
   */
  const codeOnly = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

  const mjsFiles = [];
  const collect = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (entry.name.endsWith('.mjs')) mjsFiles.push(full);
    }
  };
  collect(SCRIPTS_DIR);

  // REGRESSION for the generate-tokens.mjs row, CHARACTERIZATION for its
  // siblings — this is the one parameterized case whose label differs per row,
  // and the split is measured, not asserted: against a80514c this table failed
  // on scripts/generate-tokens.mjs (the guard was on line 346) and passed on
  // add-copyright.mjs, build-css.mjs and lib/copyright.mjs, which mention the
  // idiom only inside header docblocks that `codeOnly` strips. The row is kept
  // parameterized deliberately: it is the broadest guard in the file, and it is
  // the only case that would catch the idiom being REINTRODUCED in some other
  // script rather than in this one.
  //
  // The rule: no script anywhere under scripts/ may gate its behaviour on
  // comparing `import.meta.url` with a `pathToFileURL(argv[1])` href, because
  // the two disagree through any symlink. If a future script genuinely needs an
  // is-main check, compare `realpathSync` of both sides — or better, follow the
  // split used here and by PR #11 and put the pure half in scripts/lib/ so no
  // guard is needed at all.
  it.each(mjsFiles.map((f) => [relative(REPO, f), f]))(
    '%s does not gate on pathToFileURL(process.argv[1])',
    (_label, file) => {
      const code = codeOnly(readFileSync(file, 'utf8'));

      expect(code).not.toMatch(/pathToFileURL\s*\(\s*process\.argv\s*\[\s*1\s*\]/);
      expect(code).not.toMatch(/import\s*\.\s*meta\s*\.\s*url\s*[!=]==/);
    },
  );

  // CHARACTERIZATION — the scan is only meaningful if it actually found files.
  it('scanned at least the three known scripts', () => {
    expect(mjsFiles.length).toBeGreaterThanOrEqual(3);
  });
});
