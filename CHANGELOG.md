# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

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
