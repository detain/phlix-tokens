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
// Measured signature of this file against a80514c: `Tests 11 failed | 17 passed
// (28)`. (28 rather than 29 because the reconstructed tree has four `.mjs` files
// under scripts/ instead of five — it predates scripts/lib/tokens.mjs — so the
// parameterized guard table at the bottom yields one row fewer.) Against the fix:
// all 29 pass.
//
// One group needs its own note: the "the scan itself flags every measured
// spelling of the guard" table near the bottom never spawns the script — it
// exercises THIS FILE's own `hasSymlinkUnsafeMainGuard` predicate against literal
// source snippets. It therefore passes against both implementations, i.e. it is
// CHARACTERIZATION under the taxonomy above, and it is labelled as such. It is
// still measured, just against the predicate rather than the generator: delete
// clause 3 of that predicate and exactly two rows go red
// (`expected false to be true`). Its job is to stop the enforcement from drifting
// narrower than the prose rule it claims to enforce.
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

/**
 * A minimal stylesheet set that satisfies every non-vacuity assertion.
 *
 * "Minimal" is defined by what `assertNonVacuous` demands, so it grew when the
 * family assertions were added: one `:root` token per non-null `FILE_FAMILY`
 * entry (spacing / radius / motion / typography) plus a per-theme `--shadow-*`
 * ladder, because `tokens.shadow` is a per-theme map (CQ3) rather than a flat
 * base subset. shadow.css deliberately uses the repo's own folded
 * `:root, [data-theme='nocturne']` idiom.
 */
const MINIMAL_CSS = {
  'colors.css': ":root { --bg: #000; }\n[data-theme='nocturne'] { --bg: #000; }\n" +
    "[data-theme='daylight'] { --bg: #fff; }\n[data-theme='midnight'] { --bg: #111; }\n",
  'density.css': "[data-density='comfortable'] { --row-h: 3rem; }\n" +
    "[data-density='compact'] { --row-h: 2rem; }\n",
  'spacing.css': ':root { --space-2: 8px; }\n',
  'radius.css': ':root { --radius-md: 8px; }\n',
  'motion.css': ':root { --dur-fast: 120ms; }\n',
  'typography.css': ':root { --font-size-md: 1rem; }\n',
  'shadow.css': ":root, [data-theme='nocturne'] { --shadow-1: 0 1px 2px #000; }\n" +
    "[data-theme='daylight'] { --shadow-1: 0 1px 2px #ccc; }\n" +
    "[data-theme='midnight'] { --shadow-1: 0 1px 3px #000; }\n",
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
    // midnight has to go from EVERY file that declares it: the shadow ladder
    // would otherwise keep tokens.midnight non-empty on its own.
    css['shadow.css'] = ":root, [data-theme='nocturne'] { --shadow-1: 0 1px 2px #000; }\n" +
      "[data-theme='daylight'] { --shadow-1: 0 1px 2px #ccc; }\n";
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

  // REGRESSION — a whole token family's source stylesheet deleted. The family
  // maps are built from a hardcoded FILE_FAMILY table, so a missing
  // typography.css emitted `tokens.typography = {}` and exited 0: every non-CSS
  // consumer (React Native / Roku) silently got an empty family. CI's drift gate
  // only catches this if nobody commits the regenerated artifact, which is
  // exactly the "gate with no teeth" shape this change exists to remove.
  it('fails when a token family loses its source stylesheet', () => {
    const css = { ...MINIMAL_CSS };
    delete css['typography.css'];
    const root = makeScratch({ css });
    const r = run(join(root, 'scripts', 'generate-tokens.mjs'));

    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/token family 'typography' resolved to 0 tokens/);
    // The message must name the file to look at, not just the family.
    expect(r.stderr).toMatch(/src\/css\/typography\.css/);
    expect(existsSync(tsOut(root))).toBe(false);
  });

  // REGRESSION — same hole for the per-theme half of the family assertions.
  // `tokens.shadow` is a Record<ThemeName, …> (CQ3), so one theme's ladder can
  // vanish while the family map itself stays non-empty; asserting only
  // `tokens.shadow` would miss it. The theme's own [data-theme] block still
  // declares --bg, so the per-theme token assertion above passes and this is the
  // only thing standing between a deleted ladder and a green exit 0.
  it('fails when one theme loses its shadow ladder', () => {
    const css = { ...MINIMAL_CSS };
    css['shadow.css'] = ":root, [data-theme='nocturne'] { --shadow-1: 0 1px 2px #000; }\n" +
      "[data-theme='midnight'] { --shadow-1: 0 1px 3px #000; }\n"; // daylight removed
    const root = makeScratch({ css });
    const r = run(join(root, 'scripts', 'generate-tokens.mjs'));

    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/the 'daylight' shadow ladder resolved to 0 tokens/);
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

  /**
   * The rule, stated once as ONE predicate instead of as a list of spellings:
   * no script under scripts/ may branch on `import.meta.url` compared against
   * anything derived from `process.argv[1]`, because the two disagree through any
   * symlink.
   *
   * Three clauses, applied to comment-stripped code:
   *   1. the literal shipped spelling, `pathToFileURL(process.argv[1])`;
   *   2. `import.meta.url` used as the left operand of `===`/`!==`;
   *   3. `import.meta.url` CO-OCCURRING in the same file with either
   *      `process.argv[1]` or `pathToFileURL`.
   * Clauses 1-2 alone matched only two spellings, which was narrower than the
   * prose rule they were meant to enforce: an `argv[1]` held behind a variable
   * with `import.meta.url` on the right (`pathToFileURL(entry).href ===
   * import.meta.url`) and a non-`===` spelling (`import.meta.url.endsWith(...)`)
   * both slipped through. Clause 3 closes both without enumerating spellings.
   *
   * Deliberately coarse, and the bound is stated rather than chased: clause 3
   * would also flag a script that legitimately needed `import.meta.url` and
   * `pathToFileURL` for unrelated reasons (none does — the two files using
   * `import.meta.url` in code use it only for
   * `dirname(fileURLToPath(import.meta.url))`), and it cannot see a guard that
   * reaches the entry path some other way entirely (`const [, entry] =
   * process.argv`). This scan is a backstop, not the defence: the defence is
   * STRUCTURAL — the pure half lives in scripts/lib/ so no CLI needs an is-main
   * check at all. If a script ever genuinely needs both symbols, restructure it
   * that way rather than weakening this predicate.
   */
  const GUARD = {
    pathToFileURLofArgv1: /pathToFileURL\s*\(\s*process\.argv\s*\[\s*1\s*\]/,
    importMetaUrlCompared: /import\s*\.\s*meta\s*\.\s*url\s*[!=]==/,
    importMetaUrl: /import\s*\.\s*meta\s*\.\s*url\b/,
    argv1: /process\s*\.\s*argv\s*\[\s*1\s*\]/,
    pathToFileURL: /pathToFileURL/,
  };

  /** @param code comment-stripped source (pass it through `codeOnly` first). */
  const hasSymlinkUnsafeMainGuard = (code) =>
    GUARD.pathToFileURLofArgv1.test(code) ||
    GUARD.importMetaUrlCompared.test(code) ||
    (GUARD.importMetaUrl.test(code) &&
      (GUARD.argv1.test(code) || GUARD.pathToFileURL.test(code)));

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
  // comparing `import.meta.url` with anything derived from `process.argv[1]`,
  // because the two disagree through any symlink. `hasSymlinkUnsafeMainGuard`
  // above is that rule; the two literal patterns are kept as separate assertions
  // only because they produce a sharper failure message. If a future script
  // genuinely needs an is-main check, compare `realpathSync` of both sides — or
  // better, follow the split used here and by PR #11 and put the pure half in
  // scripts/lib/ so no guard is needed at all.
  it.each(mjsFiles.map((f) => [relative(REPO, f), f]))(
    '%s does not gate on pathToFileURL(process.argv[1])',
    (_label, file) => {
      const code = codeOnly(readFileSync(file, 'utf8'));

      expect(code).not.toMatch(GUARD.pathToFileURLofArgv1);
      expect(code).not.toMatch(GUARD.importMetaUrlCompared);
      expect(hasSymlinkUnsafeMainGuard(code)).toBe(false);
    },
  );

  // CHARACTERIZATION — the scan is only meaningful if it actually found files.
  it('scanned at least the three known scripts', () => {
    expect(mjsFiles.length).toBeGreaterThanOrEqual(3);
  });

  // SELF-TEST of the scan predicate, not of the generator. Under this file's
  // two-label taxonomy these rows are CHARACTERIZATION — they never spawn the
  // script, so they pass against a80514c and against the fix alike — but they are
  // measured all the same, against the predicate rather than against the
  // implementation: delete clause 3 of `hasSymlinkUnsafeMainGuard` and exactly the
  // two rows marked "needs clause 3" go red. That is what stops the enforcement
  // above from silently drifting narrower than the prose rule it claims to
  // enforce, which is what happened before this table existed.
  describe('the scan itself flags every measured spelling of the guard', () => {
    const FLAGGED = {
      'the literal shipped form':
        'if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();',
      'operands reversed, argv[1] literal':
        'if (pathToFileURL(process.argv[1]).href === import.meta.url) main();',
      'negated (early-return style)':
        'if (import.meta.url !== pathToFileURL(process.argv[1]).href) return;',
      'whitespace inside the index':
        'if (import.meta.url === pathToFileURL(process . argv [ 1 ]).href) main();',
      // needs clause 3 — neither literal pattern fires on these two.
      'argv[1] behind a variable, import.meta.url on the right':
        'const entry = process.argv[1];\nif (pathToFileURL(entry).href === import.meta.url) main();',
      'a non-=== spelling': 'if (import.meta.url.endsWith(process.argv[1])) main();',
    };

    const NOT_FLAGGED = {
      '__dirname via fileURLToPath': 'const __dirname = dirname(fileURLToPath(import.meta.url));',
      'import.meta.resolve': "const p = import.meta.resolve('./lib/tokens.mjs');",
      'the idiom inside a block comment':
        '/* import.meta.url === pathToFileURL(process.argv[1]).href */\nexport const x = 1;',
      'the idiom inside a line comment':
        '// import.meta.url === pathToFileURL(process.argv[1]).href\nexport const x = 1;',
      'process.argv[1] with no import.meta.url anywhere':
        'const entry = process.argv[1];\nconsole.log(entry);',
    };

    it.each(Object.entries(FLAGGED))('flags %s', (_label, src) => {
      expect(hasSymlinkUnsafeMainGuard(codeOnly(src))).toBe(true);
    });

    it.each(Object.entries(NOT_FLAGGED))('does not flag %s', (_label, src) => {
      expect(hasSymlinkUnsafeMainGuard(codeOnly(src))).toBe(false);
    });
  });
});
