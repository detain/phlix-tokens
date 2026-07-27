/**
 * Type declarations for the pure helpers exported by `scripts/lib/tokens.mjs`.
 *
 * `scripts/lib/tokens.mjs` is side-effect free, so importing it from a test can
 * never write a file — which is why `scripts/generate-tokens.mjs` needs no
 * `import.meta.url === pathToFileURL(process.argv[1]).href` main-guard (that
 * idiom silently evaluates false through a symlink and turned the whole
 * generator into a zero-output, exit-0 no-op; see the header of
 * scripts/lib/tokens.mjs).
 *
 * This file declares only the surface imported from TYPESCRIPT (test/tokens.test.ts).
 * The module exports more than this — buildTokens, assertNonVacuous, renderJson,
 * renderTs, parseRules, classify, stripComments, resolveMap, THEME_NAMES,
 * DENSITY_NAMES, NON_TOKEN_CSS, FILE_FAMILY — consumed by plain-`.mjs` callers
 * (scripts/generate-tokens.mjs, test/generate-tokens.test.mjs) that TypeScript
 * never type-checks. Add a declaration here BEFORE importing any of those from a
 * `.ts` file; a declaration with no TypeScript consumer is a lie waiting to
 * drift, so the list is kept deliberately short rather than exhaustive.
 */

/**
 * Resolve `var(--ref[, fallback])` chains within a single scope map. Throws via
 * `assertVarFallbackDepth` if a fallback nests parentheses deeper than the
 * single-level resolver supports (B4 — fail closed, never silently mis-resolve).
 */
export function resolveValue(
  value: string,
  scope: Record<string, string>,
  seen?: Set<string>,
): string;

/**
 * Throw if a `var()` fallback nests parentheses deeper than one level (which the
 * generator's single-level `varRe` cannot correctly capture). No-op otherwise.
 */
export function assertVarFallbackDepth(value: string): void;
