# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
