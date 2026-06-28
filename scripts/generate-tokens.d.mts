/**
 * Type declarations for the importable helpers exported by
 * `scripts/generate-tokens.mjs`. The generator only runs `main()` (which writes
 * files) when executed as the CLI entry point; importing it is side-effect-free
 * and exposes `resolveValue` + `assertVarFallbackDepth` for unit testing (B4).
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
