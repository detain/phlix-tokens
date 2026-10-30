<!-- GENERATED FILE — DO-NOT-EDIT.
     Source:  src/tokens.generated.json (the same resolved map shipped as dist/tokens.json).
     Rebuild: npm run generate:reference
     Law:     sections follow the generated map's canonical family order (identical to
              dist/tokens.json key order); rows preserve declaration order within each
              source block; theme- and density-keyed families collapse to one row per
              token, columns in canonical order. -->

# Token reference

140 distinct custom properties. Values are the resolved ones (every `var(--ref)` is collapsed), exactly as `resolveTheme()` and the CSS ship them. Sections mirror the shape of the generated map (`tokens.base`, per-theme, per-family views), so a property may be listed more than once — always with the same value. Which of these plugin themes may override is governed by the server's `ThemeTokenAllowlist` (cross-repo contract; see README → Naming).

## Color and geometry — resolved `:root` defaults
_The full resolved map for a page with no `data-*` attributes set (the `:root` blocks fold the Nocturne defaults); the per-theme and per-family sections below regroup the same names. Theme-scoped `--shadow-*`/`--glow-*` and the `--color-*` legacy aliases are re-declared inside every `[data-theme=…]` block (CSS var() substitution resolves on the same element)._

| token | value |
| --- | --- |
| `--amber-50` | `#fff8ec` |
| `--amber-100` | `#ffedcc` |
| `--amber-200` | `#ffd894` |
| `--amber-300` | `#ffbf5c` |
| `--amber-400` | `#fbab36` |
| `--amber-500` | `#f5a524` |
| `--amber-600` | `#d98209` |
| `--amber-700` | `#b4610a` |
| `--amber-800` | `#924d10` |
| `--amber-900` | `#783f11` |
| `--amber-950` | `#441f06` |
| `--accent-contrast` | `#2a1804` |
| `--accent` | `#f5a524` |
| `--accent-hover` | `#fbab36` |
| `--accent-active` | `#d98209` |
| `--accent-soft` | `rgba(245, 165, 36, 0.14)` |
| `--accent-ring` | `rgba(245, 165, 36, 0.55)` |
| `--accent-text` | `#f5a524` |
| `--bg` | `#0b0a08` |
| `--surface` | `#16130f` |
| `--surface-2` | `#211c16` |
| `--surface-3` | `#2c251c` |
| `--surface-glass` | `rgba(28, 23, 17, 0.62)` |
| `--surface-glass-strong` | `rgba(20, 16, 11, 0.82)` |
| `--text` | `#f3ece1` |
| `--text-muted` | `#b8ab98` |
| `--text-subtle` | `#918370` |
| `--text-faint` | `#544a3f` |
| `--text-on-accent` | `#2a1804` |
| `--border` | `#2b2419` |
| `--border-subtle` | `#1d1810` |
| `--border-strong` | `#3a3122` |
| `--error` | `#ef5e57` |
| `--error-bg` | `rgba(239, 94, 87, 0.14)` |
| `--success` | `#61c073` |
| `--success-bg` | `rgba(97, 192, 115, 0.14)` |
| `--warning` | `#e8a33d` |
| `--warning-bg` | `rgba(232, 163, 61, 0.14)` |
| `--info` | `#5aa9d6` |
| `--info-bg` | `rgba(90, 169, 214, 0.14)` |
| `--grain-opacity` | `0.05` |
| `--vignette` | `rgba(0, 0, 0, 0.55)` |
| `--ambient` | `rgba(245, 165, 36, 0.22)` |
| `--color-bg` | `#0b0a08` |
| `--color-surface` | `#16130f` |
| `--color-surface-hover` | `#211c16` |
| `--color-surface-elevated` | `#211c16` |
| `--color-surface-active` | `#2c251c` |
| `--color-text` | `#f3ece1` |
| `--color-text-secondary` | `#b8ab98` |
| `--color-text-muted` | `#b8ab98` |
| `--color-text-subtle` | `#918370` |
| `--color-primary` | `#f5a524` |
| `--color-primary-hover` | `#fbab36` |
| `--color-primary-active` | `#d98209` |
| `--color-border` | `#2b2419` |
| `--color-border-subtle` | `#1d1810` |
| `--color-error` | `#ef5e57` |
| `--color-error-bg` | `rgba(239, 94, 87, 0.14)` |
| `--color-success` | `#61c073` |
| `--color-success-bg` | `rgba(97, 192, 115, 0.14)` |
| `--color-warning` | `#e8a33d` |
| `--color-warning-bg` | `rgba(232, 163, 61, 0.14)` |
| `--color-info` | `#5aa9d6` |
| `--color-info-bg` | `rgba(90, 169, 214, 0.14)` |
| `--control-h` | `2.5rem` |
| `--control-pad-x` | `0.875rem` |
| `--control-gap` | `0.5rem` |
| `--field-pad-y` | `0.75rem` |
| `--stack-gap` | `1rem` |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` |
| `--dur-fast` | `120ms` |
| `--dur-base` | `200ms` |
| `--dur-slow` | `320ms` |
| `--dur-slower` | `480ms` |
| `--radius-sm` | `6px` |
| `--radius-md` | `10px` |
| `--radius-lg` | `14px` |
| `--radius-xl` | `20px` |
| `--radius-2xl` | `28px` |
| `--radius-full` | `9999px` |
| `--shadow-1` | `0 1px 2px rgba(0, 0, 0, 0.45)` |
| `--shadow-2` | `0 4px 14px rgba(0, 0, 0, 0.48)` |
| `--shadow-3` | `0 14px 36px rgba(0, 0, 0, 0.55)` |
| `--shadow-4` | `0 28px 64px -16px rgba(0, 0, 0, 0.72)` |
| `--glow-amber` | `0 0 0 1px rgba(245, 165, 36, 0.35), 0 10px 36px -8px rgba(245, 165, 36, 0.40)` |
| `--shadow-xs` | `0 1px 2px rgba(0, 0, 0, 0.45)` |
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.45)` |
| `--shadow-md` | `0 4px 14px rgba(0, 0, 0, 0.48)` |
| `--shadow-lg` | `0 14px 36px rgba(0, 0, 0, 0.55)` |
| `--shadow-xl` | `0 14px 36px rgba(0, 0, 0, 0.55)` |
| `--shadow-2xl` | `0 28px 64px -16px rgba(0, 0, 0, 0.72)` |
| `--space-0` | `0` |
| `--space-1` | `0.25rem` |
| `--space-2` | `0.5rem` |
| `--space-3` | `0.75rem` |
| `--space-4` | `1rem` |
| `--space-5` | `1.25rem` |
| `--space-6` | `1.5rem` |
| `--space-8` | `2rem` |
| `--space-10` | `2.5rem` |
| `--space-12` | `3rem` |
| `--space-16` | `4rem` |
| `--space-20` | `5rem` |
| `--space-24` | `6rem` |
| `--font-display` | `'Fraunces', 'Fraunces Fallback', Georgia, 'Times New Roman', serif` |
| `--font-sans` | `'Hanken Grotesk', 'Hanken Grotesk Fallback', system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--font-mono` | `'JetBrains Mono', 'JetBrains Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace` |
| `--text-2xs` | `0.6875rem` |
| `--text-xs` | `0.75rem` |
| `--text-sm` | `0.8125rem` |
| `--text-base` | `0.9375rem` |
| `--text-md` | `1.0625rem` |
| `--text-lg` | `1.25rem` |
| `--text-xl` | `clamp(1.4rem, 1.1rem + 1.2vw, 1.75rem)` |
| `--text-2xl` | `clamp(1.8rem, 1.3rem + 2vw, 2.5rem)` |
| `--text-3xl` | `clamp(2.4rem, 1.6rem + 3.2vw, 3.75rem)` |
| `--text-4xl` | `clamp(3rem, 1.9rem + 4.4vw, 4.5rem)` |
| `--text-5xl` | `clamp(3.5rem, 2rem + 6vw, 6rem)` |
| `--text-hero` | `clamp(3rem, 1.8rem + 5vw, 5.5rem)` |
| `--font-normal` | `400` |
| `--fw-regular` | `400` |
| `--font-medium` | `500` |
| `--fw-medium` | `500` |
| `--font-semibold` | `600` |
| `--fw-semibold` | `600` |
| `--font-bold` | `700` |
| `--fw-bold` | `700` |
| `--tracking-tight` | `-0.02em` |
| `--tracking-snug` | `-0.01em` |
| `--tracking-normal` | `0` |
| `--tracking-wide` | `0.04em` |
| `--tracking-caps` | `0.12em` |
| `--leading-tight` | `1.1` |
| `--leading-snug` | `1.3` |
| `--leading-normal` | `1.55` |
| `--leading-relaxed` | `1.7` |

## Color — per-theme overrides
_From the `[data-theme=…]` blocks in `src/css/colors.css`; columns in canonical theme order._

| token | nocturne | daylight | midnight |
| --- | --- | --- | --- |
| `--accent` | `#f5a524` | `#f5a524` | `#f5a524` |
| `--accent-hover` | `#fbab36` | `#d98209` | `#fbab36` |
| `--accent-active` | `#d98209` | `#b4610a` | `#d98209` |
| `--accent-soft` | `rgba(245, 165, 36, 0.14)` | `rgba(217, 130, 9, 0.12)` | `rgba(245, 165, 36, 0.16)` |
| `--accent-ring` | `rgba(245, 165, 36, 0.55)` | `rgba(146, 77, 16, 0.85)` | `rgba(245, 165, 36, 0.60)` |
| `--accent-text` | `#f5a524` | `#924d10` | `#f5a524` |
| `--bg` | `#0b0a08` | `#f7f1e6` | `#000000` |
| `--surface` | `#16130f` | `#fffdf8` | `#0a0807` |
| `--surface-2` | `#211c16` | `#f1e8d8` | `#141009` |
| `--surface-3` | `#2c251c` | `#e8dcc6` | `#1d1710` |
| `--surface-glass` | `rgba(28, 23, 17, 0.62)` | `rgba(255, 253, 248, 0.70)` | `rgba(10, 8, 6, 0.70)` |
| `--surface-glass-strong` | `rgba(20, 16, 11, 0.82)` | `rgba(255, 253, 248, 0.90)` | `rgba(0, 0, 0, 0.85)` |
| `--text` | `#f3ece1` | `#2a2017` | `#ede6da` |
| `--text-muted` | `#b8ab98` | `#6b5d49` | `#a99d8c` |
| `--text-subtle` | `#918370` | `#746753` | `#897a68` |
| `--text-faint` | `#544a3f` | `#b7a98f` | `#463d33` |
| `--text-on-accent` | `#2a1804` | `#2a1804` | `#2a1804` |
| `--border` | `#2b2419` | `#e3d6c0` | `#211b12` |
| `--border-subtle` | `#1d1810` | `#efe6d6` | `#120e09` |
| `--border-strong` | `#3a3122` | `#d3c2a4` | `#322a1c` |
| `--error` | `#ef5e57` | `#b53832` | `#ef5e57` |
| `--error-bg` | `rgba(239, 94, 87, 0.14)` | `rgba(195, 60, 54, 0.10)` | `rgba(239, 94, 87, 0.16)` |
| `--success` | `#61c073` | `#26743b` | `#61c073` |
| `--success-bg` | `rgba(97, 192, 115, 0.14)` | `rgba(47, 143, 73, 0.10)` | `rgba(97, 192, 115, 0.16)` |
| `--warning` | `#e8a33d` | `#9b5309` | `#e8a33d` |
| `--warning-bg` | `rgba(232, 163, 61, 0.14)` | `rgba(180, 97, 10, 0.10)` | `rgba(232, 163, 61, 0.16)` |
| `--info` | `#5aa9d6` | `#2d6a91` | `#5aa9d6` |
| `--info-bg` | `rgba(90, 169, 214, 0.14)` | `rgba(47, 111, 151, 0.10)` | `rgba(90, 169, 214, 0.16)` |
| `--grain-opacity` | `0.05` | `0.025` | `0.06` |
| `--vignette` | `rgba(0, 0, 0, 0.55)` | `rgba(74, 55, 20, 0.10)` | `rgba(0, 0, 0, 0.70)` |
| `--ambient` | `rgba(245, 165, 36, 0.22)` | `rgba(245, 165, 36, 0.18)` | `rgba(245, 165, 36, 0.24)` |
| `--color-bg` | `#0b0a08` | `#f7f1e6` | `#000000` |
| `--color-surface` | `#16130f` | `#fffdf8` | `#0a0807` |
| `--color-surface-hover` | `#211c16` | `#f1e8d8` | `#141009` |
| `--color-surface-elevated` | `#211c16` | `#f1e8d8` | `#141009` |
| `--color-surface-active` | `#2c251c` | `#e8dcc6` | `#1d1710` |
| `--color-text` | `#f3ece1` | `#2a2017` | `#ede6da` |
| `--color-text-secondary` | `#b8ab98` | `#6b5d49` | `#a99d8c` |
| `--color-text-muted` | `#b8ab98` | `#6b5d49` | `#a99d8c` |
| `--color-text-subtle` | `#918370` | `#746753` | `#897a68` |
| `--color-primary` | `#f5a524` | `#f5a524` | `#f5a524` |
| `--color-primary-hover` | `#fbab36` | `#d98209` | `#fbab36` |
| `--color-primary-active` | `#d98209` | `#b4610a` | `#d98209` |
| `--color-border` | `#2b2419` | `#e3d6c0` | `#211b12` |
| `--color-border-subtle` | `#1d1810` | `#efe6d6` | `#120e09` |
| `--color-error` | `#ef5e57` | `#b53832` | `#ef5e57` |
| `--color-error-bg` | `rgba(239, 94, 87, 0.14)` | `rgba(195, 60, 54, 0.10)` | `rgba(239, 94, 87, 0.16)` |
| `--color-success` | `#61c073` | `#26743b` | `#61c073` |
| `--color-success-bg` | `rgba(97, 192, 115, 0.14)` | `rgba(47, 143, 73, 0.10)` | `rgba(97, 192, 115, 0.16)` |
| `--color-warning` | `#e8a33d` | `#9b5309` | `#e8a33d` |
| `--color-warning-bg` | `rgba(232, 163, 61, 0.14)` | `rgba(180, 97, 10, 0.10)` | `rgba(232, 163, 61, 0.16)` |
| `--color-info` | `#5aa9d6` | `#2d6a91` | `#5aa9d6` |
| `--color-info-bg` | `rgba(90, 169, 214, 0.14)` | `rgba(47, 111, 151, 0.10)` | `rgba(90, 169, 214, 0.16)` |
| `--shadow-1` | `0 1px 2px rgba(0, 0, 0, 0.45)` | `0 1px 2px rgba(74, 55, 20, 0.10)` | `0 1px 2px rgba(0, 0, 0, 0.70)` |
| `--shadow-2` | `0 4px 14px rgba(0, 0, 0, 0.48)` | `0 4px 14px rgba(74, 55, 20, 0.12)` | `0 4px 14px rgba(0, 0, 0, 0.70)` |
| `--shadow-3` | `0 14px 36px rgba(0, 0, 0, 0.55)` | `0 14px 36px rgba(74, 55, 20, 0.16)` | `0 14px 36px rgba(0, 0, 0, 0.80)` |
| `--shadow-4` | `0 28px 64px -16px rgba(0, 0, 0, 0.72)` | `0 28px 64px -16px rgba(74, 55, 20, 0.24)` | `0 28px 64px -16px rgba(0, 0, 0, 0.90)` |
| `--glow-amber` | `0 0 0 1px rgba(245, 165, 36, 0.35), 0 10px 36px -8px rgba(245, 165, 36, 0.40)` | `0 0 0 1px rgba(217, 130, 9, 0.30), 0 10px 36px -8px rgba(245, 165, 36, 0.35)` | `0 0 0 1px rgba(245, 165, 36, 0.40), 0 10px 36px -8px rgba(245, 165, 36, 0.45)` |
| `--shadow-xs` | `0 1px 2px rgba(0, 0, 0, 0.45)` | `0 1px 2px rgba(74, 55, 20, 0.10)` | `0 1px 2px rgba(0, 0, 0, 0.70)` |
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.45)` | `0 1px 2px rgba(74, 55, 20, 0.10)` | `0 1px 2px rgba(0, 0, 0, 0.70)` |
| `--shadow-md` | `0 4px 14px rgba(0, 0, 0, 0.48)` | `0 4px 14px rgba(74, 55, 20, 0.12)` | `0 4px 14px rgba(0, 0, 0, 0.70)` |
| `--shadow-lg` | `0 14px 36px rgba(0, 0, 0, 0.55)` | `0 14px 36px rgba(74, 55, 20, 0.16)` | `0 14px 36px rgba(0, 0, 0, 0.80)` |
| `--shadow-xl` | `0 14px 36px rgba(0, 0, 0, 0.55)` | `0 14px 36px rgba(74, 55, 20, 0.16)` | `0 14px 36px rgba(0, 0, 0, 0.80)` |
| `--shadow-2xl` | `0 28px 64px -16px rgba(0, 0, 0, 0.72)` | `0 28px 64px -16px rgba(74, 55, 20, 0.24)` | `0 28px 64px -16px rgba(0, 0, 0, 0.90)` |

## Spacing
_From `src/css/spacing.css`._

| token | value |
| --- | --- |
| `--space-0` | `0` |
| `--space-1` | `0.25rem` |
| `--space-2` | `0.5rem` |
| `--space-3` | `0.75rem` |
| `--space-4` | `1rem` |
| `--space-5` | `1.25rem` |
| `--space-6` | `1.5rem` |
| `--space-8` | `2rem` |
| `--space-10` | `2.5rem` |
| `--space-12` | `3rem` |
| `--space-16` | `4rem` |
| `--space-20` | `5rem` |
| `--space-24` | `6rem` |

## Radius
_From `src/css/radius.css`._

| token | value |
| --- | --- |
| `--radius-sm` | `6px` |
| `--radius-md` | `10px` |
| `--radius-lg` | `14px` |
| `--radius-xl` | `20px` |
| `--radius-2xl` | `28px` |
| `--radius-full` | `9999px` |

## Shadow / glow
_Theme-scoped (`src/css/shadow.css` declares distinct ladders per theme)._

| token | nocturne | daylight | midnight |
| --- | --- | --- | --- |
| `--shadow-1` | `0 1px 2px rgba(0, 0, 0, 0.45)` | `0 1px 2px rgba(74, 55, 20, 0.10)` | `0 1px 2px rgba(0, 0, 0, 0.70)` |
| `--shadow-2` | `0 4px 14px rgba(0, 0, 0, 0.48)` | `0 4px 14px rgba(74, 55, 20, 0.12)` | `0 4px 14px rgba(0, 0, 0, 0.70)` |
| `--shadow-3` | `0 14px 36px rgba(0, 0, 0, 0.55)` | `0 14px 36px rgba(74, 55, 20, 0.16)` | `0 14px 36px rgba(0, 0, 0, 0.80)` |
| `--shadow-4` | `0 28px 64px -16px rgba(0, 0, 0, 0.72)` | `0 28px 64px -16px rgba(74, 55, 20, 0.24)` | `0 28px 64px -16px rgba(0, 0, 0, 0.90)` |
| `--glow-amber` | `0 0 0 1px rgba(245, 165, 36, 0.35), 0 10px 36px -8px rgba(245, 165, 36, 0.40)` | `0 0 0 1px rgba(217, 130, 9, 0.30), 0 10px 36px -8px rgba(245, 165, 36, 0.35)` | `0 0 0 1px rgba(245, 165, 36, 0.40), 0 10px 36px -8px rgba(245, 165, 36, 0.45)` |
| `--shadow-xs` | `0 1px 2px rgba(0, 0, 0, 0.45)` | `0 1px 2px rgba(74, 55, 20, 0.10)` | `0 1px 2px rgba(0, 0, 0, 0.70)` |
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.45)` | `0 1px 2px rgba(74, 55, 20, 0.10)` | `0 1px 2px rgba(0, 0, 0, 0.70)` |
| `--shadow-md` | `0 4px 14px rgba(0, 0, 0, 0.48)` | `0 4px 14px rgba(74, 55, 20, 0.12)` | `0 4px 14px rgba(0, 0, 0, 0.70)` |
| `--shadow-lg` | `0 14px 36px rgba(0, 0, 0, 0.55)` | `0 14px 36px rgba(74, 55, 20, 0.16)` | `0 14px 36px rgba(0, 0, 0, 0.80)` |
| `--shadow-xl` | `0 14px 36px rgba(0, 0, 0, 0.55)` | `0 14px 36px rgba(74, 55, 20, 0.16)` | `0 14px 36px rgba(0, 0, 0, 0.80)` |
| `--shadow-2xl` | `0 28px 64px -16px rgba(0, 0, 0, 0.72)` | `0 28px 64px -16px rgba(74, 55, 20, 0.24)` | `0 28px 64px -16px rgba(0, 0, 0, 0.90)` |

## Motion
_From `src/css/motion.css`._

| token | value |
| --- | --- |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` |
| `--dur-fast` | `120ms` |
| `--dur-base` | `200ms` |
| `--dur-slow` | `320ms` |
| `--dur-slower` | `480ms` |

## Density
_From the `[data-density=…]` blocks in `src/css/density.css`._

| token | comfortable | compact |
| --- | --- | --- |
| `--control-h` | `2.5rem` | `2.125rem` |
| `--control-pad-x` | `0.875rem` | `0.625rem` |
| `--control-gap` | `0.5rem` | `0.375rem` |
| `--field-pad-y` | `0.75rem` | `0.5rem` |
| `--stack-gap` | `1rem` | `0.625rem` |

## Typography
_From `src/css/typography.css` — both `--text-*` families live here: type SIZES (`--text-2xs` … `--text-hero`); the text COLOR roles live in the Color sections above (README → Naming)._

| token | value |
| --- | --- |
| `--font-display` | `'Fraunces', 'Fraunces Fallback', Georgia, 'Times New Roman', serif` |
| `--font-sans` | `'Hanken Grotesk', 'Hanken Grotesk Fallback', system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--font-mono` | `'JetBrains Mono', 'JetBrains Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace` |
| `--text-2xs` | `0.6875rem` |
| `--text-xs` | `0.75rem` |
| `--text-sm` | `0.8125rem` |
| `--text-base` | `0.9375rem` |
| `--text-md` | `1.0625rem` |
| `--text-lg` | `1.25rem` |
| `--text-xl` | `clamp(1.4rem, 1.1rem + 1.2vw, 1.75rem)` |
| `--text-2xl` | `clamp(1.8rem, 1.3rem + 2vw, 2.5rem)` |
| `--text-3xl` | `clamp(2.4rem, 1.6rem + 3.2vw, 3.75rem)` |
| `--text-4xl` | `clamp(3rem, 1.9rem + 4.4vw, 4.5rem)` |
| `--text-5xl` | `clamp(3.5rem, 2rem + 6vw, 6rem)` |
| `--text-hero` | `clamp(3rem, 1.8rem + 5vw, 5.5rem)` |
| `--font-normal` | `400` |
| `--fw-regular` | `400` |
| `--font-medium` | `500` |
| `--fw-medium` | `500` |
| `--font-semibold` | `600` |
| `--fw-semibold` | `600` |
| `--font-bold` | `700` |
| `--fw-bold` | `700` |
| `--tracking-tight` | `-0.02em` |
| `--tracking-snug` | `-0.01em` |
| `--tracking-normal` | `0` |
| `--tracking-wide` | `0.04em` |
| `--tracking-caps` | `0.12em` |
| `--leading-tight` | `1.1` |
| `--leading-snug` | `1.3` |
| `--leading-normal` | `1.55` |
| `--leading-relaxed` | `1.7` |
