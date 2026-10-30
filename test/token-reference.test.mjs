/**
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// Tests for the token reference doc pipeline (scripts/lib/token-reference.mjs
// + the committed docs/token-reference.md).
//
// Two laws hold the doc: (1) FRESHNESS — the committed file must equal a
// rebuild from src/tokens.generated.json (the same artifact CI pins against
// the CSS); (2) COVERAGE — every custom property in the map must actually
// appear in the doc, so a renderer that silently drops a family can never
// pass law 1 by agreeing with itself about a truncated table.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderReference, distinctPropertyCount } from '../scripts/lib/token-reference.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_JSON = join(REPO, 'src', 'tokens.generated.json');
const DOC_MD = join(REPO, 'docs', 'token-reference.md');

const tokens = JSON.parse(readFileSync(SRC_JSON, 'utf8')).tokens;

/** Every custom-property name anywhere in the map (variant tables included). */
function allPropertyNames(map) {
  const names = new Set();
  for (const value of Object.values(map)) {
    for (const [key, inner] of Object.entries(value)) {
      if (inner !== null && typeof inner === 'object') {
        for (const name of Object.keys(inner)) {
          if (name.startsWith('--')) names.add(name);
        }
      } else if (key.startsWith('--')) {
        names.add(key);
      }
    }
  }
  return names;
}

describe('token reference doc', () => {
  it('committed docs/token-reference.md equals a rebuild from the generated map', () => {
    const committed = readFileSync(DOC_MD, 'utf8');
    expect(committed).toBe(renderReference(tokens));
  });

  it('the doc lists every custom property in the map, and the census header agrees', () => {
    const committed = readFileSync(DOC_MD, 'utf8');
    expect(committed.startsWith('<!-- GENERATED FILE')).toBe(true);
    const names = allPropertyNames(tokens);
    for (const name of names) {
      expect(committed).toContain('`' + name + '`');
    }
    expect(committed).toContain(`${distinctPropertyCount(tokens)} distinct custom properties`);
    // Characterization of the scan itself: if name collection ever went
    // vacuous, the loop above would pass on nothing.
    expect(names.size).toBeGreaterThanOrEqual(140);
  });
});
