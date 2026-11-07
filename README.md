# @phlix/tokens

[![CI](https://github.com/detain/phlix-tokens/actions/workflows/ci.yml/badge.svg)](https://github.com/detain/phlix-tokens/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/tag/detain/phlix-tokens?label=version&sort=semver)](https://github.com/detain/phlix-tokens/tags)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Framework-agnostic **design tokens** for Phlix — the single source of truth
for the web theme tokens. Inside this package the CSS, JS and JSON forms are
generated from one source and CI-gated so they never drift (within the
package's own forms — plugin themes may still override individual tokens at
runtime through the server's `ThemeTokenAllowlist`, and that override layer
lives in the theme repos, outside this package's drift gate); across the
estate, adoption is by mechanism:

- **Direct consumers:** phlix-ui (imports `@phlix/tokens/style.css` and reads
  the `./css/*` text in tests — it does not import the JS/JSON maps; pins
  `github:detain/phlix-tokens#v0.2.1`) and phlix-server
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
npm i github:detain/phlix-tokens#v0.2.3
```

Pin a tag: `phlix-tokens` is consumed by tag-pinned tarball across the estate
(ui pins `#v0.2.1`; server vendors the `v0.2.2` archive and byte-pins
`src/css/colors.css` — both as measured at the 2026-11-06 tree; the v0.2.3
re-pin waves rotate them in the coordinated order below), and the bare
`github:detain/phlix-tokens` form resolves
the moving default branch. The npm-registry name is not published.

## Usage — web (CSS variables)

A full generated enumeration — every custom property with its resolved value
(theme- and density-keyed families side by side) — lives in
[`docs/token-reference.md`](./docs/token-reference.md); rebuild it with
`npm run generate:reference`.

Import the self-contained stylesheet once at app entry. It declares the token
custom properties scoped to `:root` and the `[data-theme=…]` / `[data-density=…]`
blocks; the `[data-reduced-motion=…]` kill-switch is scoped the same way, to the
subtree carrying the attribute. Note that `style.css` = tokens **+ an opinionated global reset + two
utility classes**: the same file also ships `*, *::before, *::after` margin
zeroing and `box-sizing`, list/button/link resets, and the `.numeric` /
`.eyebrow` helpers. For tokens only, skip `style.css` and import the individual
family files instead (below):

```ts
import '@phlix/tokens/style.css';
```

Then select a theme/density on `<html>` (or any element) — either by setting the
attributes yourself or via the helper:

```ts
import { applyTokenAttributes } from '@phlix/tokens';

applyTokenAttributes(document.documentElement, {
  theme: 'nocturne',     // 'nocturne' | 'daylight' | 'midnight'
  density: 'comfortable', // 'comfortable' | 'compact'
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

**Fonts: stacks here, faces elsewhere.** The `--font-display` / `--font-sans` /
`--font-mono` stacks name **Fraunces**, **Hanken Grotesk** and **JetBrains Mono**,
but this package ships the *stacks only* — the `@font-face` declarations live in
the app shell (`phlix-ui/src/assets/fonts/fonts.css`), not in this repo. Resolved
values handed to a React Native or Roku consumer therefore reference family names
the platform does not know: register the fonts on that platform yourself, or
accept the stack's system fallbacks.

The same data is also available as JSON. The document's top-level envelope is
`{ tokens, themes }`: `data.tokens` is the same map as the `tokens` import
(a bare `data` is **not** the same shape), and `data.themes` carries the flat
per-theme resolved maps behind `resolveTheme`:

```ts
import data from '@phlix/tokens/tokens.json';
```

### Deriving a custom accent

`deriveAccentVars(hex, scheme?)` produces the full accent role set
(hover/active/soft/ring/text/contrast) from a single hex — the same pure logic
phlix-ui's accent picker uses:

```ts
import { deriveAccentVars } from '@phlix/tokens';

deriveAccentVars('#3366ff');          // dark-scheme target (default)
deriveAccentVars('#3366ff', 'light'); // light-scheme target (e.g. daylight)
// { '--accent': '#3366ff', …, '--accent-text': …, '--accent-contrast': '#fff8ec' }
```

`--accent-contrast` is picked from `ACCENT_INK_DARK` / `ACCENT_INK_LIGHT` (also
exported), the single source of truth shared with `--accent-contrast` in
`src/css/colors.css`. The text role `--accent-text` follows the per-scheme law
the colors.css blocks encode: dark themes use the accent hue itself (AA on
their dark surfaces); a `light` target darkens the hue in bounded steps until
it clears AA against `LIGHT_TEXT_REFERENCE` (daylight `--surface-3`, the
darkest shipped light background) — the continuous form of the ramp law by
which daylight ships `var(--amber-800)` under its amber-500 fill, where the
raw hue measures only 1.82–2.01:1 as text. `THEME_SCHEMES` maps each theme to
its branch (pinned against colors.css's own `color-scheme:` declarations), and
`applyTokenAttributes` consults it so an accent override re-paints the text
role per the target scheme's law (dark: the hue itself; light: the AA-darkened
step) instead of leaving it on the theme ramp.

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
Within the color family, **`--text-faint` is decorative-only**: measured
1.88–2.29:1 on its theme surfaces it sits below AA and below the 3:1 non-text
floor, so it belongs to watermark glyphs, divider ghosts and texture — never
to meaningful text. The shipped guard pins that sub-3:1 posture with
deliberately-inverted assertions: any value lift reddens the suite so this
paragraph and the live label sites rotate in the same commit (a move toward
AA is an owner-gated, parity-tested cascade, not a drive-by).

The direction pair is easy to invert: `--accent-text` is the accent color used
**as** foreground; `--text-on-accent` is the foreground painted **on** an
accent fill. The companion law is fill-vs-foreground: `--accent` itself is a
**fill** — as text it measures 1.82–2.01:1 on daylight's surfaces, so never
paint text with `--accent` directly; take accent-colored text from
`--accent-text` (darkened to AA on light schemes; see "Deriving a custom
accent") and ink-on-fill from `--text-on-accent`. The `--color-*` legacy set is pure aliases of the canonical names,
kept for un-migrated consumers — never add new tokens there. The aliases
remain until a coordinated breaking wave retires them; removal is a
minor-major event (the server's allowlist and transcription parse these names,
and ui plus the plugin themes consume them), with intent logged 2026-10-30
alongside the `--fw-*` weight aliases.

**Roadmap codes.** Some `src/css/` comments carry `R0.x`/`R1`–`R4` style labels
("Nocturne design system, R0.1", "the primitives (R0.4) …"). These are inherited
era markers from the planning roadmap of phlix-ui — the package these files were
extracted from at 0.1.0 — where `R<n>` numbered a roadmap round (R1 the theme
plumbing, R2 the grid, R4 the appearance preview, and so on). Nothing in this
repo is keyed on them and no live document defines them here; read them as
"which round of the old plan introduced this rule", never as scope for current
work. Stripping them from the shipped CSS comments is deliberately not done
here: the comment bytes are part of the vendored, pin-governed surface. The
same era-marking applies to the file banners: six of the eight `src/css/*.css`
files still carry an `@phlix/ui` header (colors, density, motion, radius,
shadow, typography; spacing and index carry only the copyright line) — the
extraction-era provenance of the 0.1.0 copy-out, not a claim that these files
live upstream.

**`--font-*` and `--fw-*` are one scale written twice.** `--font-normal` /
`--font-medium` / `--font-semibold` / `--font-bold` are canonical; the
`--fw-regular` / `--fw-medium` / `--fw-semibold` / `--fw-bold` family
(`typography.css:46-49`) is a legacy alias set declaring `var(--font-*)`
values. Prefer `--font-*` in new code. Retiring `--fw-*` is logged as intent
on 2026-10-30 and rides the first deliberate breaking CSS-surface release —
the alias bytes live in `typography.css`, which is copied verbatim into the
vendored `dist/css/` and inlined `dist/style.css` surfaces consumers pin and
measure (the same name-set-and-order law the server parity guard holds for
`colors.css`), so removal is a coordinated server re-pin + ui bump, never a
drive-by.

**Borders are ambient, not component boundaries.** No `--border*` token reaches
the WCAG 1.4.11 3:1 non-text floor against its theme's surfaces — this is the
stated posture, not an oversight: form boundaries lean on labels and
placeholders. The shipped contrast guard (Step CONTRAST in `test/tokens.test.ts`)
pins eight foreground/background pairs × three themes at the AA 4.5:1 text
threshold (`--text`, `--text-on-accent`, `--text-muted`, `--accent-text`,
`--text-subtle` over their rated backgrounds — every ratio the colors.css
comments assert), checks the daylight focus ring's ≥3:1 composite separately,
and pins `--text-faint`'s decorative-only posture with inverted assertions;
borders are deliberately outside its scope. A consumer that needs a
3:1 interactive edge must supply its own color today. Adding a
`--border-component` token is cure-spec'd (measured candidate values on record
in this repo's review fixlog) for a deliberate future release — a new name is
itself a frozen-surface change.

**TV substrates read this scale as web-first.** The type ramp targets desktop
web: `--text-base` is `0.9375rem` (15px) and `--text-2xs` is `0.6875rem` (11px),
and this package ships **no border-width tokens** — every consumer hardcodes
`1px`. On 10-foot TV surfaces (the tizen and windows embeds) 15px is roughly
1.4% of 1080p height against the classic viewing-distance minimum of ~2%
(~21.6px), and hairlines thin out under 4K upscaling. Those surfaces must scale
the root font-size rather than expect a different token set. A `--border-w`
scale (plus a `data-density='tv'` step) is cure-spec'd in this repo's review
fixlog for a deliberate release — new names are frozen-surface changes, so they
never ride a docs patch. One web-engine floor is already inside the scale: the
six top type steps (`--text-xl` … `--text-hero`, `typography.css:38-43`) are
`clamp()` expressions — the package's only modern CSS construct — and need
Chrome 79 / Safari 13.1 or newer (2020). This package declares no browser floor
of its own; the tizen contract floor (Chromium ≥ 85,
`phlix-tizen-client/docs/runtime-floor.md`) already clears it. An older engine
that cannot parse `clamp()` still stores the custom property: token values are
unparsed token streams, so the failure surfaces at computed-value time when the
`var()` reference substitutes — a literal fallback (`var(--text-xl, 1.75rem)`)
does **not** rescue it, because `var()` fallbacks fire only for never-defined
properties, never for defined-but-invalid ones.

## Regenerating tokens

The JS token objects are generated from `src/css/*.css`. After editing the CSS,
regenerate the committed `src/tokens.generated.{ts,json}`:

```sh
npm run generate
```

The generator is pure and deterministic (no network, no clock/random). CI fails
if the committed artifact is out of date, and `scripts/generate-tokens.mjs`
throws on an over-nested `var()` fallback rather than mis-resolving it.

`docs/token-reference.md` is derived from the same generated artifact: after
editing CSS, regenerate **both** (`npm run generate && npm run generate:reference`).
The committed doc is pinned against a rebuild by
`test/token-reference.test.mjs`, so a stale reference fails the suite.

## Releasing tokens — the cascade

`npm run generate && npm run build` ends this repo's job, but both consumers pin
bytes, so a CSS edit is only half the change. The surfaces, in custody order:

- `src/css/*.css` — the hand-edited source. Copied **verbatim** (comments
  included) into `dist/css/*.css` and inlined into `dist/style.css` by
  `scripts/build-css.mjs`.
- `src/tokens.generated.{ts,json}` — generated from `src/css` by
  `npm run generate`; CI fails if committed copies are stale.
- `dist/` — the committed build output (`style.css`, `css/*`, `tokens.json`,
  the bundles + `.d.ts`).
- `docs/token-reference.md` — generated from the same resolved map by
  `npm run generate:reference`; pinned by its own test.

Downstream pins (as measured at the v0.2.1 era):

- **phlix-ui** depends on `github:detain/phlix-tokens#v0.2.1` — a **tag**, so
  nothing reaches ui until this repo tags — and its build embeds
  `dist/style.css`.
- **phlix-server** vendors the tag's **codeload tarball over an immutable
  commit SHA** as a dev-only, commit-pinned composer package, and
  `tests/Unit/Theming/ColorsCssParityTest.php` (1) sha256-pins the vendored
  `src/css/colors.css` against its `COLORS_CSS_SHA256` constant, (2) parses it
  and diffs name-for-name **and value-for-value** against the `BuiltInThemes`
  transcription, (3) diffs the plugin-settable surface against
  `ThemeTokenAllowlist` — all by **name set and declaration order**.

The laws that make a "harmless" CSS reshuffle breaking:

1. **Re-sorting or interleaving declarations in `colors.css` is a breaking
   change** — the server guard diffs order, not just content. Same value,
   new line, red CI downstream.
2. The **`:root`-fold idiom**: the nocturne theme doubles as the default via
   the folded selector `:root, [data-theme='nocturne']` (`colors.css`,
   `shadow.css`; `density.css` does the same for `comfortable`), which
   populates the base group and the theme group from one block — the server
   parse depends on it (see the RELAX-DELIBERATELY note in
   `scripts/lib/tokens.mjs`). Moving to `:root`-only defaults requires an
   intentional assertion relaxation on both sides, never a silent edit.
3. Adding or removing a token name is the same class of cascade as a re-sort
   (frozen surface); so is any change to `src/css` **comment bytes** — they
   ride into the vendored files verbatim.

**Release-note wording law:** never say "zero bytes moved" for a tag range
without naming which artifacts. Doc-comment edits to `src/` are byte-frozen
nowhere — `.d.ts` files carry the docblocks and the `.map` files embed the full
sources — so `git diff <prev-tag> <tag> -- dist/` can legitimately move files
while every value-carrying artifact (`style.css`, `css/*`, `tokens.json`, the
bundles) is byte-identical. State exactly that split; the bare "zero bytes"
form is falsifiable by the very entries that booked the comment moves (the
v0.2.2 range is the recorded example).

Coordinated release order: land here → push → tag → server re-pin (composer
pin + `ColorsCssParityTest` sha/transcription/allowlist refresh) → ui tag-pin
bump. One dated lesson from history: through the v0.2.1 era the server guard's
docblock narrated its chain-of-custody from the older tag commit
(`colors.css @ 5500d70b, tag v0.2.0`) while its lock fetched the `v0.2.1` tag
archive — pin *provenance* drifting even when bytes don't. The v0.2.2 re-pin
wave closed that instance (the docblock now cites the `v0.2.2` tag commit); the
drift class is why the law below stands. Treat the sha constant's **name** as
the living
contract, never README lore: this section quotes no sha value, so it cannot rot
on the next re-pin.

## Scripts

| script           | purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `npm run generate` | parse CSS → write `src/tokens.generated.{ts,json}`        |
| `npm run generate:reference` | render `docs/token-reference.md` from `src/tokens.generated.json` |
| `npm run typecheck`| `tsc --noEmit` (strict)                                   |
| `npm run build`    | generate → typecheck → vite lib build (ES+CJS) → d.ts → CSS |
| `npm run test`     | vitest (watch)                                            |
| `npm run test:run` | vitest run (once)                                         |
| `npm run lint`     | eslint                                                    |
| `npm run copyright`| stamp the `@copyright` header on `src/**`/`test/**` (idempotent) |

## License

MIT
