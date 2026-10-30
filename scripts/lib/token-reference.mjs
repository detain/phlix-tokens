/**
 * token-reference.mjs — the PURE half of the docs generator: render every
 * custom property from the generated token map into a markdown reference
 * table (docs/token-reference.md). No fs, no clock, no network: importing
 * this module can never write a file, which is why (per the repo's
 * no-symlink-unsafe-main-guard law, see generate-tokens.mjs) the CLI half
 * lives in ../generate-token-reference.mjs and the rendering here is
 * unit-testable directly.
 *
 * Data source: the parsed `src/tokens.generated.json` — the SAME resolved
 * map that ships as `dist/tokens.json`. The doc is therefore provably equal
 * to what consumers read, never a hand-copied approximation of it.
 *
 * Ordering law (stated in the rendered header too): sections follow the
 * generated map's canonical family key order (identical to dist/tokens.json);
 * rows preserve declaration order within each source block; theme-set- and
 * density-set-keyed families collapse to one row per token with columns in
 * canonical theme/density order.
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// Canonical column groups. A section's value is either a flat
// Record<name, value> or a Record<variant, Record<name, value>> keyed by
// these names in this order.
const THEME_SECTION_ORDER = ['nocturne', 'daylight', 'midnight'];
const DENSITY_SECTION_ORDER = ['comfortable', 'compact'];

/** Escape the only byte that can corrupt a markdown table row. */
function mdCell(value) {
  return String(value).split('|').join('\\|');
}

/**
 * Assert the shape this renderer depends on, fail-loud. Called before any
 * rendering: a generated map that grew a fourth theme, a new cross-family, or
 * a per-variant section with mismatched key lists must stop the build with a
 * description, not render a subtly wrong table (and a vacuous renderer must
 * never exit 0 — same doctrine as the token generator).
 */
export function assertReferenceable(tokens) {
  if (!tokens || typeof tokens !== 'object' || Object.keys(tokens).length === 0) {
    throw new Error('token-reference: empty or missing `tokens` map — refusing to render a vacuous reference');
  }
  const themeBlock = tokens.nocturne;
  if (!themeBlock || Object.keys(themeBlock).length === 0) {
    throw new Error('token-reference: `tokens.nocturne` missing or empty — the colors.css model drifted');
  }
  for (const theme of THEME_SECTION_ORDER) {
    if (!tokens[theme] || Object.keys(tokens[theme]).length === 0) {
      throw new Error(`token-reference: theme block \`${theme}\` missing or empty`);
    }
    const a = Object.keys(tokens.nocturne).join(',');
    const b = Object.keys(tokens[theme]).join(',');
    if (a !== b) {
      throw new Error(
        `token-reference: theme blocks \`nocturne\` and \`${theme}\` disagree on key list (name-set AND order); ` +
          `the per-theme colors.css blocks must declare the same properties in the same order`,
      );
    }
  }
  for (const density of DENSITY_SECTION_ORDER) {
    if (!tokens.density?.[density]) {
      throw new Error(`token-reference: density variant \`${density}\` missing under tokens.density`);
    }
    const a = Object.keys(tokens.density.comfortable).join(',');
    const b = Object.keys(tokens.density[density]).join(',');
    if (a !== b) {
      throw new Error(`token-reference: density variants disagree on key list (\`${density}\` vs \`comfortable\`)`);
    }
  }
  // Flat sections must not carry nested records (would silently drop keys).
  for (const [key, value] of Object.entries(tokens)) {
    if (THEME_SECTION_ORDER.includes(key) || key === 'density' || key === 'shadow') continue;
    for (const inner of Object.values(value)) {
      if (inner !== null && typeof inner === 'object') {
        throw new Error(`token-reference: flat section \`${key}\` carries a nested record — the model grew beyond this renderer`);
      }
    }
  }
}

function flatRows(section) {
  return Object.entries(section).map(([name, value]) => `| \`${mdCell(name)}\` | \`${mdCell(value)}\` |`);
}

function variantRows(tables, variantOrder) {
  const base = tables[variantOrder[0]];
  return Object.keys(base).map((name) => {
    const cells = variantOrder.map((v) => `\`${mdCell(tables[v][name])}\``);
    return `| \`${mdCell(name)}\` | ${cells.join(' | ')} |`;
  });
}

/** Count distinct custom properties across the whole map (variants merged). */
export function distinctPropertyCount(tokens) {
  const names = new Set();
  for (const value of Object.values(tokens)) {
    for (const [key, inner] of Object.entries(value)) {
      if (inner !== null && typeof inner === 'object') {
        // variant table (theme- or density-keyed): the real names are inside
        for (const name of Object.keys(inner)) {
          if (name.startsWith('--')) names.add(name);
        }
      } else if (key.startsWith('--')) {
        names.add(key);
      }
    }
  }
  return names.size;
}

/**
 * Render the full markdown document (terminating newline included, matching
 * the repo's file idiom). Deterministic: byte-identical for the same input.
 */
export function renderReference(tokens) {
  assertReferenceable(tokens);

  const lines = [];
  lines.push('<!-- GENERATED FILE — DO-NOT-EDIT.');
  lines.push('     Source:  src/tokens.generated.json (the same resolved map shipped as dist/tokens.json).');
  lines.push('     Rebuild: npm run generate:reference');
  lines.push('     Law:     sections follow the generated map\'s canonical family order (identical to');
  lines.push('              dist/tokens.json key order); rows preserve declaration order within each');
  lines.push('              source block; theme- and density-keyed families collapse to one row per');
  lines.push('              token, columns in canonical order. -->');
  lines.push('');
  lines.push('# Token reference');
  lines.push('');
  lines.push(
    `${distinctPropertyCount(tokens)} distinct custom properties. ` +
      'Values are the resolved ones (every `var(--ref)` is collapsed), exactly as `resolveTheme()` and the CSS ship them. ' +
      'Sections mirror the shape of the generated map (`tokens.base`, per-theme, per-family views), so a property may be listed more than once — ' +
      'always with the same value. ' +
      'Which of these plugin themes may override is governed by the server\'s `ThemeTokenAllowlist` (cross-repo contract; see README → Naming).',
  );

  const flatHeader = (title, note) => {
    lines.push('');
    lines.push(`## ${title}`);
    if (note) lines.push(`_${note}_`);
    lines.push('');
    lines.push('| token | value |');
    lines.push('| --- | --- |');
  };

  let emittedThemeSection = false;
  for (const [key, value] of Object.entries(tokens)) {
    if (THEME_SECTION_ORDER.includes(key)) {
      if (emittedThemeSection) continue;
      emittedThemeSection = true;
      lines.push('');
      lines.push('## Color — per-theme overrides');
      lines.push('_From the `[data-theme=…]` blocks in `src/css/colors.css`; columns in canonical theme order._');
      lines.push('');
      lines.push(`| token | ${THEME_SECTION_ORDER.join(' | ')} |`);
      lines.push(`| --- | ${THEME_SECTION_ORDER.map(() => '---').join(' | ')} |`);
      lines.push(...variantRows(tokens, THEME_SECTION_ORDER));
      continue;
    }
    if (key === 'density') {
      lines.push('');
      lines.push('## Density');
      lines.push('_From the `[data-density=…]` blocks in `src/css/density.css`._');
      lines.push('');
      lines.push(`| token | ${DENSITY_SECTION_ORDER.join(' | ')} |`);
      lines.push(`| --- | ${DENSITY_SECTION_ORDER.map(() => '---').join(' | ')} |`);
      lines.push(...variantRows(tokens.density, DENSITY_SECTION_ORDER));
      continue;
    }
    if (key === 'shadow') {
      lines.push('');
      lines.push('## Shadow / glow');
      lines.push('_Theme-scoped (`src/css/shadow.css` declares distinct ladders per theme)._');
      lines.push('');
      lines.push(`| token | ${THEME_SECTION_ORDER.join(' | ')} |`);
      lines.push(`| --- | ${THEME_SECTION_ORDER.map(() => '---').join(' | ')} |`);
      lines.push(...variantRows(tokens.shadow, THEME_SECTION_ORDER));
      continue;
    }
    switch (key) {
      case 'base':
        flatHeader(
          'Color and geometry — resolved `:root` defaults',
          'The full resolved map for a page with no `data-*` attributes set (the `:root` blocks fold the Nocturne defaults); the per-theme and per-family sections below regroup the same names. Theme-scoped `--shadow-*`/`--glow-*` and the `--color-*` legacy aliases are re-declared inside every `[data-theme=…]` block (CSS var() substitution resolves on the same element).',
        );
        lines.push(...flatRows(value));
        break;
      case 'spacing':
        flatHeader('Spacing', 'From `src/css/spacing.css`.');
        lines.push(...flatRows(value));
        break;
      case 'radius':
        flatHeader('Radius', 'From `src/css/radius.css`.');
        lines.push(...flatRows(value));
        break;
      case 'motion':
        flatHeader('Motion', 'From `src/css/motion.css`.');
        lines.push(...flatRows(value));
        break;
      case 'typography':
        flatHeader('Typography', 'From `src/css/typography.css` — both `--text-*` families live here: type SIZES (`--text-2xs` … `--text-hero`); the text COLOR roles live in the Color sections above (README → Naming).');
        lines.push(...flatRows(value));
        break;
      default:
        throw new Error(`token-reference: unexpected section \`${key}\` in the generated map — update this renderer deliberately, never silently`);
    }
  }

  return `${lines.join('\n')}\n`;
}
