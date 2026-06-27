# @phlix/tokens

[![CI](https://github.com/detain/phlix-tokens/actions/workflows/ci.yml/badge.svg)](https://github.com/detain/phlix-tokens/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/detain/phlix-tokens/graph/badge.svg)](https://codecov.io/gh/detain/phlix-tokens)
[![Version](https://img.shields.io/github/v/tag/detain/phlix-tokens?label=version&sort=semver)](https://github.com/detain/phlix-tokens/tags)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Framework-agnostic **design tokens** for Phlix — the single source of truth for
theme tokens shared across every client so they never drift:

- **Web** clients (phlix-ui, windows, tizen) consume the shipped CSS custom
  properties.
- **Non-CSS** clients (React Native mobile, Roku) consume the resolved JS/JSON
  token maps.

It has **no dependency on Vue, Pinia, or vue-router**, so it is safe to import
from a React Native bundle.

The authoritative web artifact is the CSS in [`src/css/`](./src/css), copied
byte-for-byte from phlix-ui's `src/tokens/`. The JS token objects in
`src/tokens.generated.ts` are **generated** from that CSS (var() references
resolved to concrete values per theme), guaranteeing zero visual drift.

## Install

```sh
npm i github:detain/phlix-tokens
```

## Usage — web (CSS variables)

Import the self-contained stylesheet once at app entry. It declares the token
custom properties scoped to `:root` and the `[data-theme=…]` / `[data-density=…]`
blocks:

```ts
import '@phlix/tokens/style.css';
```

Then select a theme/density on `<html>` (or any element) — either by setting the
attributes yourself or via the helper:

```ts
import { applyTokenAttributes } from '@phlix/tokens';

applyTokenAttributes(document.documentElement, {
  theme: 'nocturne',     // 'nocturne' | 'daylight' | 'midnight'
  density: 'comfortable',// 'comfortable' | 'compact'
  reducedMotion: false,
  accent: null,          // or a hex string to override the default amber
});
```

Individual token files are also exported if you want to import a subset:

```ts
import '@phlix/tokens/css/colors.css';
import '@phlix/tokens/css/spacing.css';
```

## Usage — React Native / Roku (resolved values)

There are no CSS variables in React Native, so read the **flat resolved map** for
a theme. Every `var(--ref)` is already resolved to a concrete value;
`clamp()` / `rgba()` strings are preserved as-is.

```ts
import { tokens, resolveTheme } from '@phlix/tokens';

const t = resolveTheme('nocturne');
t['--bg'];     // '#0b0a08'
t['--accent']; // '#f5a524'
t['--text'];   // '#f3ece1'

tokens.spacing['--space-4'];   // '1rem'
tokens.radius['--radius-lg'];  // '14px'
tokens.density.compact['--control-h']; // '2.125rem'
```

The same data is also available as JSON:

```ts
import data from '@phlix/tokens/tokens.json';
```

### Deriving a custom accent

`deriveAccentVars(hex)` produces the full accent role set (hover/active/soft/
ring/contrast) from a single hex — the same pure logic phlix-ui's accent picker
uses:

```ts
import { deriveAccentVars } from '@phlix/tokens';

deriveAccentVars('#3366ff');
// { '--accent': '#3366ff', '--accent-hover': …, '--accent-contrast': '#fff8ec', … }
```

## Regenerating tokens

The JS token objects are generated from `src/css/*.css`. After editing the CSS,
regenerate the committed `src/tokens.generated.{ts,json}`:

```sh
npm run generate
```

The generator is pure and deterministic (no network, no clock/random). CI fails
if the committed artifact is out of date.

## Scripts

| script           | purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `npm run generate` | parse CSS → write `src/tokens.generated.{ts,json}`        |
| `npm run typecheck`| `tsc --noEmit` (strict)                                   |
| `npm run build`    | generate → typecheck → vite lib build (ES+CJS) → d.ts → CSS |
| `npm run test`     | vitest (watch)                                            |
| `npm run test:run` | vitest run (once)                                         |
| `npm run lint`     | eslint                                                    |

## License

MIT
