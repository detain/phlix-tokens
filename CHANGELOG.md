# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Theme parity CI guard (PARITY). A new `theme parity` test suite asserts that
  all three theme maps (`tokens.nocturne` / `tokens.daylight` / `tokens.midnight`)
  declare the **same key set** (currently 64 keys each, no per-theme-only keys).
  Enforced by the existing `test:run` CI step — no workflow change. Hardens
  against future B1-class drift where a token is added to one theme but not the
  others. An explicit (currently empty) allow-list is provided for any future
  intentional per-theme-only key, so the assertion is never silently weakened.
- WCAG contrast-pair CI guard (CONTRAST). A new `contrast` test suite computes
  WCAG ratios `(Lmax + 0.05)/(Lmin + 0.05)` via the exported `parseHex` +
  `luminance` and asserts AA (≥ 4.5:1) for each theme on the key pairs:
  `--text` on `--bg` and on `--surface`, `--text-on-accent` on `--accent` (the
  B2-unified ink, provably readable on amber), and `--text-muted` on `--surface`.
  All current values clear full AA with margin (lowest measured = daylight
  `--text-muted` on `--surface` at 6.28:1), so no large-text 3:1 relaxation is
  used. A deliberately low-contrast pair would trip the guard. Test-only; no
  generator/CSS/dist change.

### Changed

- **Minor breaking:** `tokens.shadow` is now theme-aware (CQ3). It changes shape
  from a single `Record<string, string>` (always the Nocturne ladder) to a
  per-theme `Record<ThemeName, Record<string, string>>`, mirroring
  `tokens.density`. `shadow.css` declares distinct ladders per theme (daylight is
  brown-tinted + softer, midnight is heavier), so a non-CSS consumer (React
  Native / Roku) now gets the correct ladder for the active theme instead of
  always the dark Nocturne ladder. **Consumers reading `tokens.shadow['--shadow-2']`
  must move to `tokens.shadow.nocturne['--shadow-2']`** (or the active theme).
  Cross-repo grep at authoring time (2026-06-28) found **no** `tokens.shadow`
  usage in phlix-ui / phlix-mobile-client / phlix-roku-client (nor the
  windows/tizen/console clients), so this break is latent in practice; any
  consumer updates are tracked as separate PRs. The `resolveTheme(name)` path is
  unaffected (it already returns per-theme resolved `--shadow-*` values).

### Fixed

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
    with zero `:root` tokens, zero tokens in any of the three themes, or zero
    tokens in either density variant, and an empty `src/css` is rejected up front;
    each artifact is then read back and **byte-compared** after writing. Previously
    all of these wrote structurally valid but all-empty artifacts and exited 0.
  - **CI proves the drift gate can fail.** A new `Prove the up-to-date gate is not
    vacuous` step perturbs both artifacts and requires `generate` to restore them
    byte-for-byte. Measured against the pre-fix generator: the old gate returns 0
    (no teeth) where the new probe returns 1.
  Regression coverage is `test/generate-tokens.test.mjs`, which spawns the script
  as a real child process against throwaway trees, including through both a
  symlinked file and a symlinked directory. Measured against `a80514c`:
  **9 failed | 6 passed (15)**; against this fix all 16 pass. Every case carries a
  `REGRESSION` / `CHARACTERIZATION` label derived from that A/B, reproducible via
  the two documented env overrides. Its last table also asserts that **no** script
  under `scripts/` gates on `pathToFileURL(process.argv[1])`, so the idiom cannot
  come back in a sibling script. Sweep result: `generate-tokens.mjs` was the only
  file in the repo still carrying it.
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
  generator itself behind a CLI-entry main-guard, and since the symlink fix below
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
