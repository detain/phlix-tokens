/**
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect } from 'vitest';
import { injectTsDocblock, prependTsDocblock, COPYRIGHT, MARKER } from '../scripts/lib/copyright.mjs';

// Mirrors the pattern used in add-copyright.test.mjs for the CSS side
function processTsFile(content) {
  if (content.includes(MARKER)) return null;
  return injectTsDocblock(content) ?? prependTsDocblock(content);
}

describe('injectTsDocblock (TS/JS docblock copyright injection)', () => {
  // REGRESSION (this fix) — injectTsDocblock was completely untested before.
  // This is the TS/JS equivalent of the CSS injectCssComment regression guards.
  it('inserts copyright inside an existing docblock', () => {
    const input = ['/**', ' * Some header', ' *', ' * @description test', ' */', '', 'export const x = 1;'].join('\n');
    const result = injectTsDocblock(input);
    expect(result).not.toBeNull();
    expect(result).toContain(COPYRIGHT.trim());
    // copyright should be inside the docblock, not after it
    const lines = result.split('\n');
    const copyIdx = lines.findIndex((l) => l.includes('@copyright'));
    const closeIdx = lines.findIndex((l) => l.trim() === '*/');
    expect(copyIdx).toBeGreaterThan(0);
    expect(copyIdx).toBeLessThan(closeIdx);
  });

  it('is idempotent: file with existing copyright returns null', () => {
    const input = ['/**', ' * @copyright 2025 Someone', ' */', 'export const x = 1;'].join('\n');
    expect(injectTsDocblock(input)).toBeNull();
  });

  it('returns null when file has no leading docblock', () => {
    const input = 'export const x = 1;\n';
    expect(injectTsDocblock(input)).toBeNull();
  });

  it('returns null for an unclosed docblock', () => {
    const input = ['/**', ' * unclosed', 'more code'].join('\n');
    expect(injectTsDocblock(input)).toBeNull();
  });

  it('finds docblock after shebang', () => {
    const input = ['#!/usr/bin/env node', '/**', ' * header', ' */', 'export const x = 1;'].join('\n');
    const result = injectTsDocblock(input);
    expect(result).not.toBeNull();
    expect(result).toContain(COPYRIGHT.trim());
  });

  it('does not inject into middle of file docblock-like content', () => {
    const input = ['const x = 1;', '/**', ' * middle docblock', ' */', 'const y = 2;'].join('\n');
    // Only considers /** at the very start (after optional shebang)
    expect(injectTsDocblock(input)).toBeNull();
  });

  // Test the composed path (inject-or-prepend) for completeness
  it('composed path (inject-or-prepend) handles file without docblock', () => {
    const input = 'export const x = 1;\n';
    const result = processTsFile(input);
    expect(result).not.toBeNull();
    expect(result).toContain(COPYRIGHT.trim());
    expect(result).toContain('export const x = 1;');
  });

  it('composed path is idempotent', () => {
    const input = ['/**', ' * @copyright 2026 Joe Huss <detain@interserver.net>', ' */', 'export const x = 1;'].join('\n');
    expect(processTsFile(input)).toBeNull();
  });

  // B2 single-source-of-truth regression guard: the runtime accent-picker path
  // (deriveAccentVars) and the static CSS `--accent-contrast` must agree for the
  // default amber. For TS/JS, prependTsDocblock is used for the header.
  it('prependTsDocblock adds copyright after shebang', () => {
    const input = '#!/usr/bin/env node\nexport const x = 1;\n';
    const result = prependTsDocblock(input);
    expect(result).toContain(COPYRIGHT.trim());
    const lines = result.split('\n');
    const shebangIdx = lines.findIndex((l) => l.startsWith('#!'));
    const copyIdx = lines.findIndex((l) => l.includes('@copyright'));
    expect(shebangIdx).toBe(0);
    expect(copyIdx).toBeGreaterThan(shebangIdx);
    expect(copyIdx).toBeLessThan(lines.indexOf('export const x = 1;'));
  });

  it('prependTsDocblock handles file without shebang', () => {
    const input = 'export const x = 1;\n';
    const result = prependTsDocblock(input);
    expect(result).toContain(COPYRIGHT.trim());
    expect(result).toContain('export const x = 1;');
  });
});
