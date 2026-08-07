# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-07

> ### ⚠ Do not diff this release against the `v0.1.1` tag
>
> **The `v0.1.1` tag sits on a DISJOINT history.** This repository has two root
> commits (`53a6273` and `f8230f5`) and `git merge-base v0.1.1 HEAD` returns
> **nothing** — the tag and `master` share no common ancestor. Consequences:
>
> - A GitHub `v0.1.1...v0.2.0` compare view is **fabricated**. So is
>   `git log v0.1.1..HEAD` (it reports ~28 commits, but that is "every commit
>   reachable from HEAD", not a release delta).
> - The only meaningful comparison is the **tree** diff, which ignores history:
>   `git diff v0.1.1 HEAD -- src` (add `-- dist` for the shipped artifacts).
>
> Consumers upgrading from `0.1.1` should read this entry and the tree diff, not
> the commit range. The `v0.2.0` tag will be cut on `master`, so `v0.2.0` and
> everything after it will compare normally.

### Added

- Public accent-ink constants. `ACCENT_INK_DARK` (`#2a1804`) and
  `ACCENT_INK_LIGHT` (`#fff8ec`) are now **exported from the package root**
  (`src/accent.ts` → `src/index.ts`), so a consumer can reference the same ink
  values `deriveAccentVars` and `colors.css` use instead of re-hardcoding a hex.
  See the B2 entry under *Fixed* for why they exist.
- `scripts/lib/` — side-effect-free extracted modules. The pure logic of both
  build scripts now lives in `scripts/lib/tokens.mjs` (489 lines: CSS parsing,
  `var()` resolution, family partitioning, both renderers) and
  `scripts/lib/copyright.mjs` (277 lines), with types in
  `scripts/lib/tokens.d.mts` (which replaces `scripts/generate-tokens.d.mts`).
  `scripts/generate-tokens.mjs`, `scripts/build-css.mjs` and the new
  `scripts/add-copyright.mjs` are thin CLI shells over them. Importing a lib
  module reads no files, writes no files and lists no directories, so a unit
  test can never touch the tree — which is what let the main-guard be **deleted**
  rather than repaired (see *Fixed*). Build output is unaffected; this is an
  internal reorganisation of the generator only.
- Substantially expanded test suite. `test/` grows from **1 file / 262 lines**
  at `v0.1.1` to **6 files / 2,382 lines**, running **156 tests**:
  `tokens.test.ts` (588), `lib-tokens.test.mjs` (562), `add-copyright.test.mjs`
  (535), `generate-tokens.test.mjs` (507), `lib-copyright.test.mjs` (93) and
  `build-css.test.mjs` (97). The three `*-tokens`/`build-css`/`add-copyright`
  CLI suites spawn the real scripts as **child processes** against throwaway
  trees rather than importing them, so they exercise the shipped entry points.
  Measured coverage at this release: **276/360 statements (76.66%)**, **152/185
  branches (82.16%)**, **230/306 lines (75.16%)**. Every non-CLI file is at
  **100% lines** (`scripts/lib/tokens.mjs` 132/132, `scripts/lib/copyright.mjs`
  60/60, `src/accent.ts` 21/21, `src/themes.ts` 17/17); the whole shortfall is
  the three CLI entry points at 0% (`add-copyright.mjs` 0/38,
  `generate-tokens.mjs` 0/21, `build-css.mjs` 0/17), which v8 cannot attribute
  because they only ever run in a subprocess. No coverage threshold is
  configured, so none of this gates.
- CI now produces a coverage report and uploads it to Codacy, and
  `vite.config.ts` emits the report **even when tests fail** (previously a red
  suite produced no report at all, so the one run you most wanted to inspect was
  the one with no data).
- Theme parity CI guard (PARITY). A new `theme parity` test suite asserts that
  all three theme maps (`tokens.nocturne` / `tokens.daylight` / `tokens.midnight`)
  declare the **same key set** (currently 64 keys each, no per-theme-only keys
  — re-counted from `src/tokens.generated.json` at release: nocturne 64,
  daylight 64, midnight 64, and the three sorted key lists are identical).
  Enforced by the existing `test:run` CI step — no workflow change. Hardens
  against future B1-class drift where a token is added to one theme but not the
  others. An explicit (currently empty) allow-list is provided for any future
  intentional per-theme-only key, so the assertion is never silently weakened.
- WCAG contrast-pair CI guard (CONTRAST). A new `contrast` test suite computes
  WCAG ratios `(Lmax + 0.05)/(Lmin + 0.05)` via the exported `parseHex` +
  `luminance` and asserts AA (≥ 4.5:1) for each theme on the key pairs:
  `--text` on `--bg` and on `--surface`, `--text-on-accent` on `--accent` (the
  B2-unified ink, provably readable on amber), and `--text-muted` on `--surface`.
  All current values clear full AA with margin, so no large-text 3:1 relaxation
  is used. Full table, **recomputed from `resolveTheme()` at release
  (2026-08-07)** rather than carried over:

  | theme    | text/bg | text/surface | on-accent/accent | muted/surface |
  | -------- | ------- | ------------ | ---------------- | ------------- |
  | nocturne | 16.87   | 15.78        | 8.36             | 8.21          |
  | daylight | 14.18   | 15.68        | 8.36             | **6.28**      |
  | midnight | 16.93   | 16.11        | 8.36             | 7.51          |

  Lowest of all twelve pairs = daylight `--text-muted` on `--surface` at
  **6.28:1** — confirmed. A deliberately low-contrast pair would trip the
  guard. Test-only; no generator/CSS/dist change.

### Changed

- **Minor breaking:** `tokens.shadow` is now theme-aware (CQ3). It changes shape
  from a single `Record<string, string>` (always the Nocturne ladder) to a
  per-theme `Record<ThemeName, Record<string, string>>`, mirroring
  `tokens.density`. `shadow.css` declares distinct ladders per theme (daylight is
  brown-tinted + softer, midnight is heavier), so a non-CSS consumer (React
  Native / Roku) now gets the correct ladder for the active theme instead of
  always the dark Nocturne ladder. **Consumers reading `tokens.shadow['--shadow-2']`
  must move to `tokens.shadow.nocturne['--shadow-2']`** (or the active theme).
  **Impact re-measured at release (2026-08-07)**, not carried over from the
  2026-06-28 authoring-time grep: literal `tokens.shadow` was searched across
  **all 14 non-token repos** under `/home/sites/phlix/` — `phlix-ui`,
  `phlix-hub`, `phlix-server`, `phlix-shared`, `phlix-contracts`, `phlix-docs`,
  `phlix-syncplay`, `phlix-plugins`, `phlix-website`, and the five clients
  (`mobile`, `roku`, `windows`, `tizen`, `console`) — excluding
  `node_modules/`, `vendor/`, `dist/`, `coverage/` and `.git/`. **Zero hits**
  in thirteen of them. The four hits in `phlix-website` are
  `design_tokens.shadow`, a brand-kit JSON path with no relation to this
  package. A second sweep for member access (`shadow[…]` / `.shadow`,
  discounting `box-shadow` / `--shadow-*` / `text-shadow` / `drop-shadow`)
  across all five client `src/` trees also returned zero. Finally, `phlix-ui`
  is the **only** repo in the estate that depends on this package at all
  (`"@phlix/tokens": "github:detain/phlix-tokens#v0.1.1"`), and it does not use
  `tokens.shadow`. So the break is real in the type signature but has no current
  consumer; a phlix-ui repin to `#v0.2.0` needs no code change on that account.
  The `resolveTheme(name)` path is unaffected (it already returns per-theme
  resolved `--shadow-*` values).

### Fixed

- **Restore `Georgia` in `--font-display`, which a lint auto-fix had silently
  lower-cased and shipped.** Between `0.1.1` and this release the token value
  drifted from `'Fraunces', 'Fraunces Fallback', Georgia, 'Times New Roman',
  serif` to `… georgia, …`. Reconstructed:
  - `7a8cb32` (*"fix: codacy issues and findings"*) made the edit. It was the
    **only** `src/` change in that commit — the other seven files were
    `.caliber/` and `.claude/` metadata — so it was never reviewed as a token
    change. Cause: a `value-keyword-case` style rule (Codacy runs stylelint
    server-side; **this repo has no stylelint of its own**, `npm run lint` is
    `eslint .` and cannot see CSS) reports an unquoted family name as a value
    keyword that "should be lowercase". stylelint's font-family exemption does
    not apply inside a *custom* property, because the rule has no way to know
    `--font-display` holds a font stack. It hit only `Georgia` and left `Menlo`
    and `SFMono-Regular` alone, so it was applied by hand from the report rather
    than by a wholesale `--fix`.
  - `2f2b703`, whose subject is `提升测试覆盖率` (*"improve test coverage"*),
    is what propagated it into `src/tokens.generated.{ts,json}`,
    `dist/tokens.json`, `dist/phlix-tokens.js`, `dist/phlix-tokens.umd.cjs`,
    `dist/style.css` and `dist/css/typography.css` — a published token-value
    change carried by a commit that announces itself as test-only.
  - **Severity: cosmetic in CSS, wrong in the JSON.** Family-name matching is
    ASCII case-insensitive, measured in Chrome rather than assumed: an installed
    multi-word family rendered at an identical 1382.671875px as
    `'DejaVu Serif'`, `'dejavu serif'`, `'DEJAVU SERIF'` and unquoted
    `dejavu serif`, while a bogus family rendered at 1138.390625px — so the
    check could distinguish a failed lookup and did not. (Georgia itself is not
    installed on the test host, hence the substitute family.) But
    `src/tokens.generated.json` exists precisely for the non-CSS clients
    (React Native / Roku), which match a font name **exactly**, and an
    unreviewed change to a published token value is the defect whether or not
    this particular one rendered.
  - **Prevention.** There is no local stylelint config to tighten, so the guard
    is a test: a new `font family tokens` suite in `test/tokens.test.ts` pins
    all three `--font-*` stacks verbatim in `src/css/typography.css`, in the
    exported `tokens`/`resolveTheme()` values, and in the committed
    `src/tokens.generated.json`, and additionally rejects a lower-cased spelling
    of any of the nine cased family names appearing **anywhere** in the JSON
    artifact. It runs under the existing `npm run test:run` CI step. Proven
    non-vacuous by re-applying the exact mutation: lower-casing `Georgia` in
    `typography.css` alone reds 1 of the 3 cases, and regenerating so the
    artifacts follow reds all 3. The CSS-source assertion strips comments before
    matching (the explanatory comment now above the declarations names every
    family, so an unstripped scan would match its own documentation) and asserts
    the strip actually ran. `src/css/typography.css` also carries a
    `stylelint-disable-next-line value-keyword-case` on each of the three
    declarations so the hosted analyser stops re-raising it.
- **`npm run generate` was a silent no-op through any symlink, which made the CI
  drift gate unable to fail.** `scripts/generate-tokens.mjs` gated `main()` on
  `import.meta.url === pathToFileURL(process.argv[1]).href`. `pathToFileURL()`
  does **not** resolve symlinks but `import.meta.url` **does** (it is always the
  realpath), so reaching the script through a symlinked file, a symlinked
  directory component or a package `bin` shim made the two hrefs differ, the
  guard false, and the whole run exit **0 having written zero bytes** — measured:
  no stdout, no files created. Because `.github/workflows/ci.yml` runs
  `npm run generate` and then `git diff --exit-code` on the committed artifacts, a
  generator that writes nothing makes that gate compare the committed artifact
  **against itself**, so it passed unconditionally. That is a CI gate that could
  not fail, and it is how the `9ec4298` token corruption stayed green. Three
  changes, none of which alter a single output byte (`src/tokens.generated.{ts,json}`
  and `dist/` are unchanged — the committed artifacts remain the correct side):
  - **The guard is gone rather than repaired.** The pure token model (CSS
    parsing, `var()` resolution, family partitioning, both renderers) moved to a
    new side-effect-free `scripts/lib/tokens.mjs`, so importing it from a test can
    never write a file and the CLI needs no main-guard at all — the same split
    PR #11 applied to `add-copyright.mjs` → `scripts/lib/copyright.mjs`. A
    symlink-safe `realpathSync` comparison would also have worked, but leaving no
    guard leaves nothing to get wrong. `scripts/generate-tokens.d.mts` is replaced
    by `scripts/lib/tokens.d.mts`.
  - **`generate` now proves it did work.** `assertNonVacuous()` rejects a model
    with zero `:root` tokens, zero tokens in any of the three themes, zero tokens
    in either density variant, or zero tokens in any token family declared by
    `FILE_FAMILY` (`spacing` / `radius` / `motion` / `typography`, plus `shadow`
    per theme — a deleted `typography.css` used to emit `tokens.typography = {}`
    and exit 0); an empty `src/css` is rejected up front; each artifact is then
    read back and **byte-compared** after writing. Previously all of these wrote
    structurally valid but all-empty artifacts and exited 0. The family checks are
    derived from the `FILE_FAMILY` table rather than hardcoded, so adding a token
    family remains a single-entry change and gets its vacuity check for free.
  - **CI proves the drift gate can fail.** A new `Prove the up-to-date gate is not
    vacuous` step perturbs both artifacts and requires `generate` to restore them
    byte-for-byte. Measured against the pre-fix generator: the old gate returns 0
    (no teeth) where the new probe returns 1.
  Regression coverage is `test/generate-tokens.test.mjs`, which spawns the script
  as a real child process against throwaway trees, including through both a
  symlinked file and a symlinked directory. Measured against `a80514c`:
  **11 failed | 17 passed (28)**; against this fix all 29 pass. Every case carries a
  `REGRESSION` / `CHARACTERIZATION` label derived from that A/B, reproducible via
  the two documented env overrides. Its last tables also assert that **no** script
  under `scripts/` branches on `import.meta.url` compared against anything derived
  from `process.argv[1]`, and that the scan itself flags every measured spelling of
  that idiom (including an `argv[1]` held behind a variable and a non-`===`
  spelling, which the two literal patterns missed), so the idiom cannot come back
  in a sibling script and the enforcement cannot drift narrower than the rule.
  Sweep result: `generate-tokens.mjs` was the only file in the repo still carrying
  it.
- `vitest` coverage now measures the build scripts. `vite.config.ts`'s
  `coverage.include` was `['src/**/*.ts']`, so `scripts/lib/tokens.mjs` and
  `scripts/lib/copyright.mjs` — the pure modules the suite imports directly —
  reported **no coverage at all**; the report covered only `src/accent.ts` and
  `src/themes.ts` and read `100% (49/49)`. `include` is now
  `['src/**/*.ts', 'scripts/**/*.mjs']` (measured at the time of that change:
  `134/361` statements, with the three CLI entry points at 0% because they are
  only ever exercised as child processes; the later test work in this release
  took it to `276/360` — see *Added*). Report-only — no coverage threshold is
  configured and CI runs plain `npm run test:run` with no `--coverage`, so no
  gate changes.
- `injectTsDocblock` is now genuinely idempotent, and `parseRules` no longer
  drops declaration-less rules. `injectTsDocblock` tested a docblock for the
  maintainer's own `MARKER` string, so a file already carrying a *differently
  worded* `@copyright` line got a **second** one appended on the next run; it now
  tests for any `@copyright`. `parseRules` guarded its output with
  `if (decls.length)`, silently discarding any rule that declares no custom
  properties — which lost comma-separated selector groups and empty blocks from
  the parsed model; the rule is now always emitted. Both live in `scripts/lib/`
  and are covered by `test/lib-copyright.test.mjs` / `test/lib-tokens.test.mjs`.
  No token value or `dist/` byte changes.
- Repair the five CSS files broken by the copyright-header pass (`9ec4298`).
  That commit inserted a **naked** `* @copyright …` line — with no `/* */`
  delimiters — into the *middle* of `radius.css` (L8), `motion.css` (L17),
  `colors.css` (L159), `density.css` (L28) and `typography.css` (L61), because
  each file already had a top-of-file block comment and the injector wrote to a
  wrong line offset. The copyright notice is now **relocated into each file's
  existing header block** (notice preserved in every file; the CSS is valid
  again). Consequences that this fixes:
  - Four real, source-defined tokens were dropped by the generator, because an
    invalid declaration line makes the parser discard the declaration that
    **follows** it: `--dur-slower: 480ms`, `--radius-2xl: 28px`, the *midnight*
    `--accent-text`, and the *compact* `--stack-gap: 0.625rem`. All four are
    restored, so `src/tokens.generated.{ts,json}` regenerate byte-identically to
    the committed artifact and the CI drift gate is green again (red since
    2026-07-08).
  - The `.eyebrow` utility rule in `typography.css` was silently **discarded by
    browsers**: the stray line sat at brace depth 0, so the rule's selector
    parsed as a dangling combinator and the whole block was thrown away.
    Verified with `lightningcss`; the rule is now emitted again.
  - `dist/` is rebuilt. The committed `dist/` predated `9ec4298`, so the shipped
    CSS/`.d.ts` artifacts never carried the headers at all; they now match a
    fresh build. `dist/tokens.json`, `dist/phlix-tokens.js` and
    `dist/phlix-tokens.umd.cjs` are **unchanged** — no token value or public API
    moved, the delta is comments only.
- Harden the generator's `var()` fallback resolution against deeply-nested
  parentheses (B4). `resolveValue`'s `varRe` captures at most **one** level of
  nested parens inside a `var()` fallback; a two-level nest (e.g.
  `var(--x, clamp(1rem, calc(2px + 1vw), 3rem))`) could be mis-captured. The
  generator now runs `assertVarFallbackDepth` on every value first and **throws a
  clear error** if a fallback nests deeper than the resolver supports, so an
  over-nested value can never silently mis-resolve. No current token hits this, so
  generation stays a byte-for-byte no-op on the real CSS (the drift gate is
  unchanged) — the guard is purely defensive. `resolveValue` /
  `assertVarFallbackDepth` are importable for unit coverage — originally from the
  generator itself behind a CLI-entry main-guard, and since the symlink fix above
  from the side-effect-free `scripts/lib/tokens.mjs`.
- Unify the two accent-contrast ("ink on accent") systems to a single source of
  truth (B2). The runtime accent picker (`deriveAccentVars`) and the static CSS
  `--accent-contrast` in `colors.css` had drifted: JS returned `#1a1205` for a
  light accent while CSS declared `#2a1804`. `src/accent.ts` now exports
  `ACCENT_INK_DARK = '#2a1804'` and `ACCENT_INK_LIGHT = '#fff8ec'` constants and
  `deriveAccentVars` references them, with a cross-reference comment in both
  `accent.ts` and `colors.css`. `#2a1804` is the canonical dark ink, so the CSS
  default and all generated/dist artifacts are **unchanged**; the only behavioral
  change is that `deriveAccentVars` now returns `#2a1804` (was `#1a1205`) as the
  dark contrast for light accents, matching the CSS default.
- Stop color tokens leaking into `tokens.typography` (B1). The generator now
  categorizes base custom properties by their **source file** instead of by
  key-prefix guessing, so the colors declared in `colors.css` — `--text-muted`,
  `--text-subtle`, `--text-faint`, `--text-on-accent` — no longer appear as hex
  values inside the `tokens.typography` convenience object. The CSS keys are
  **unchanged** (no rename), and the color names remain reachable via
  `tokens.base` / the per-theme maps / `resolveTheme()`, so consumers
  (phlix-ui and downstream) are unaffected. This also closes CQ2: adding a new
  token family is now a single `FILE_FAMILY` lookup entry, and an unrecognized
  source file fails closed (ignored) instead of being mis-categorized.

## [0.1.1] - 2026-06-26

### Fixed

- Ship the `@phlix/tokens/tokens.json` export. `build-css.mjs` now copies
  `src/tokens.generated.json` to `dist/tokens.json`, and the export points at
  `./dist/tokens.json` (which is committed + in `files`) instead of
  `./src/tokens.generated.json` (which was never in the npm tarball, so
  `import '@phlix/tokens/tokens.json'` broke on a packed/published install).
- Enable the CI gate. The `push` (master) and `pull_request` triggers were
  commented out, leaving only `workflow_dispatch`, so the README's "CI fails on
  stale artifacts" claim never held. CI now also guards committed `dist/` drift
  via `git diff --exit-code -- dist`.

## [0.1.0] - 2026-06-26

### Added

- Initial release: framework-agnostic design tokens for Phlix, extracted from
  phlix-ui so web and non-CSS clients share one source of truth.
- Shipped CSS custom properties in `src/css/` (colors, spacing, radius, shadow,
  motion, density, typography, index), copied byte-for-byte from phlix-ui's
  `src/tokens/`. Self-contained `@phlix/tokens/style.css` plus per-file
  `@phlix/tokens/css/*` exports.
- `tokens` object and `resolveTheme(name)` — resolved JS token maps (var()
  references resolved to concrete values per theme; `clamp()`/`rgba()` strings
  preserved) for React Native / Roku and other non-CSS consumers. Also emitted
  as `@phlix/tokens/tokens.json`.
- `ThemeName` / `Density` type unions, `THEMES`, `DENSITIES`, `DEFAULT_THEME`,
  `DEFAULT_DENSITY`, the `data-theme` / `data-density` / `data-reduced-motion`
  attribute constants, and a pure `applyTokenAttributes()` DOM helper.
- `deriveAccentVars(hex)` and the supporting pure color helpers (`parseHex`,
  `toHex`, `lighten`, `darken`, `rgba`, `luminance`, `ACCENT_KEYS`), ported
  verbatim from phlix-ui with no Vue dependency.
- Deterministic `scripts/generate-tokens.mjs` token generator and
  `scripts/build-css.mjs` CSS bundler.
- Vitest suite, strict TypeScript config, Vite lib build (ES + CJS + d.ts),
  flat ESLint config, and a CI workflow.
