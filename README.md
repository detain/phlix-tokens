# @phlix/tokens

[![CI](https://github.com/detain/phlix-tokens/actions/workflows/ci.yml/badge.svg)](https://github.com/detain/phlix-tokens/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/detain/phlix-tokens/graph/badge.svg)](https://codecov.io/gh/detain/phlix-tokens)
[![Version](https://img.shields.io/github/v/tag/detain/phlix-tokens?label=version&sort=semver)](https://github.com/detain/phlix-tokens/tags)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Framework-agnostic **design tokens** for Phlix — the single source of truth
for the web theme tokens. Inside this package the CSS, JS and JSON forms are
generated from one source and CI-gated so they never drift; across the estate,
adoption is by mechanism:

- **Direct consumers:** phlix-ui (imports `@phlix/tokens/style.css` and the
  JS/JSON maps; pins `github:detain/phlix-tokens#v0.2.1`) and phlix-server
  (vendors the tag-pinned tarball; its `ColorsCssParityTest` byte-pins
  `src/css/colors.css`).
- **Indirect, via the phlix-ui bundle:** the windows and tizen clients — their
  shipped SPA bundles embed this package's CSS; they do not depend on the
  package themselves.
- **Not yet migrated:** mobile (React Native) and Roku. They do **not** depend
  on `@phlix/tokens` today and keep hand-maintained values; the resolved JS/JSON
  token maps exist for exactly that future adoption, and their current copies
  are not drift-protected by this package.

It has **no dependency on Vue, Pinia, or vue-router**, so it is safe to import
from a React Native bundle once that migration lands.

The authoritative web artifact is the CSS in [`src/css/`](./src/css). These
files were extracted byte-for-byte from phlix-ui's `src/tokens/` at 0.1.0;
since phlix-ui #137 the direction is inverted — `phlix-ui/src/tokens/` no
longer holds the token CSS and instead imports this package's `style.css`.
The JS token objects in `src/tokens.generated.ts` are **generated** from that
CSS (var() references resolved to concrete values per theme), guaranteeing
zero drift between the CSS and JS/JSON forms shipped from here.

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

## Usage — non-CSS consumers (React Native / Roku, resolved values)

Mobile and Roku do not depend on this package yet (see the adoption list above);
when they migrate, this is the path. There are no CSS variables in React
Native, so read the **flat resolved map** for a theme. Every `var(--ref)` is
already resolved to a concrete value; `clamp()` / `rgba()` strings are
preserved as-is (they are CSS functional notation, not parseable numbers).

```ts
import { tokens, resolveTheme } from '@phlix/tokens';

const t = resolveTheme('nocturne');
t['--bg'];     // '#0b0a08'
t['--accent']; // '#f5a524'
t['--text'];   // '#f3ece1'

tokens.spacing['--space-4'];   // '1rem'
tokens.radius['--radius-lg'];  // '14px'
tokens.density.compact['--control-h']; // '2.125rem'
tokens.shadow.nocturne['--shadow-2'];  // '0 4px 14px rgba(0, 0, 0, 0.48)'
```

`tokens.shadow` is keyed by theme name (`Record<ThemeName, Record<string, string>>`)
so each theme's `--shadow-*` / `--glow-*` ladder resolves correctly.

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

`--accent-contrast` is picked from `ACCENT_INK_DARK` / `ACCENT_INK_LIGHT` (also
exported), the single source of truth shared with `--accent-contrast` in
`src/css/colors.css`.

## Naming

The grammar is `--<family>[-<role>[-<variant>]]`. The role is optional: the
bare family-head is a token in its own right — `--accent`, `--ambient`,
`--bg`, `--border`, `--error`, `--info`, `--success`, `--surface`, `--text`,
`--vignette`, `--warning` (11 at last census). Families are bare nouns; the
full set of first segments is 27: `accent`, `amber` (the palette ramp),
`ambient`, `bg`, `border`, `color` (the legacy alias namespace — see
below), `control` (density geometry), `dur`, `ease`, `error`, `field`,
`font`, `fw` (font weight), `glow`, `grain`, `info`, `leading`, `radius`,
`shadow`, `space`, `stack`, `success`, `surface`, `text`, `tracking`,
`vignette`, `warning`. There is deliberately **no `--phlix-` prefix**: the
bare names are the frozen contract — the server's `ThemeTokenAllowlist`
governs which of them plugin themes may override, and renaming is a
breaking cascade across server, ui, and every client. The blessed
consumption pattern is the two-argument `var(--x, literal)` fallback form
phlix-ui uses everywhere — it survives partial imports and load-order
failure. Re-count the surface area with
`grep -hoE -- '--[a-zA-Z0-9-]+:' src/css/*.css | sort -u | wc -l`
(140 at last census; the full enumeration is `dist/tokens.json`) — and the
family set with
`grep -hoE -- '--[a-zA-Z0-9-]+:' src/css/*.css | sed 's/^--//; s/:$//' | cut -d- -f1 | sort -u`
(27 names).

**`--text-*` is two families.** Colors: `--text`, `--text-muted`,
`--text-subtle`, `--text-faint`, `--text-on-accent` (defined in
`colors.css`); type sizes: `--text-2xs` … `--text-hero` (defined in
`typography.css`). The collision once caused a real shipped defect ("B1",
CHANGELOG [0.2.0]): the generator guessed families by key-prefix and color
values leaked into `tokens.typography`; it now categorizes by **source file**.
That is the law for new tokens too: the file you edit declares the family —
sizes go in `typography.css`, colors in `colors.css` — and a new *color role*
must not extend the `--text-<word>` pattern; name the component role instead.

The direction pair is easy to invert: `--accent-text` is the accent color used
**as** foreground; `--text-on-accent` is the foreground painted **on** an
accent fill. The `--color-*` legacy set is pure aliases of the canonical names,
kept for un-migrated consumers — never add new tokens there.

## Regenerating tokens

The JS token objects are generated from `src/css/*.css`. After editing the CSS,
regenerate the committed `src/tokens.generated.{ts,json}`:

```sh
npm run generate
```

The generator is pure and deterministic (no network, no clock/random). CI fails
if the committed artifact is out of date, and `scripts/generate-tokens.mjs`
throws on an over-nested `var()` fallback rather than mis-resolving it.

## Scripts

| script           | purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `npm run generate` | parse CSS → write `src/tokens.generated.{ts,json}`        |
| `npm run typecheck`| `tsc --noEmit` (strict)                                   |
| `npm run build`    | generate → typecheck → vite lib build (ES+CJS) → d.ts → CSS |
| `npm run test`     | vitest (watch)                                            |
| `npm run test:run` | vitest run (once)                                         |
| `npm run lint`     | eslint                                                    |
| `npm run copyright`| stamp the `@copyright` header on `src/**`/`test/**` (idempotent) |

`npm run copyright` (`node scripts/add-copyright.mjs`) stamps the `@copyright` header on `src/**` and
`test/**` sources.

## License

MIT
