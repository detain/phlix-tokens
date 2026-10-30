/**
 * @copyright 2026 Joe Huss <detain@interserver.net>
 *
 * M-TOKENS-16 — the reduced-motion twin, made executable.
 *
 * `src/themes.ts` states the DOM-attribute contract (`data-theme`,
 * `data-density`, `data-reduced-motion`) and promises the token CSS "must
 * stay in lockstep with src/css/*.css". Until this file that promise was
 * prose: `tokens.test.ts` pins the constants' VALUES, and nothing anywhere
 * asserted that each `[data-*='…'] selector actually exists in the shipped
 * CSS — or that the CSS declares no selector VALUE the TS unions don't know.
 * A selector rename on either side was a silent estate-wide miss.
 *
 * Method mirrors the house idiom in tokens.test.ts: read the real
 * `src/css/*.css`, STRIP comments first (comment prose names the attributes —
 * e.g. the reducedMotion='on' note in index.css — so an uncommented scan
 * would match its own docs), then assert verbatim presence both directions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  THEMES,
  DENSITIES,
  DATA_THEME,
  DATA_DENSITY,
  DATA_REDUCED_MOTION,
} from '../src/themes';

const CSS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'css');

/** Concatenated, comment-stripped source CSS — the real shipped surface. */
function strippedCss(): string {
  const files = readdirSync(CSS_DIR).filter((f) => f.endsWith('.css')).sort();
  expect(files.length, 'src/css must contain css files').toBeGreaterThanOrEqual(8);
  return files
    .map((f) => readFileSync(join(CSS_DIR, f), 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Unique values the CSS uses for one attribute inside selector brackets. */
function cssSelectorValues(code: string, attr: string): string[] {
  const re = new RegExp(`\\[${attr}='([^']+)'\\]`, 'g');
  return [...new Set([...code.matchAll(re)].map((m) => m[1]))].sort();
}

describe('theme/density/motion attribute twins (themes.ts ↔ src/css)', () => {
  const code = strippedCss();

  // Non-vacuity for the comment strip: this phrase exists ONLY inside the
  // reduced-motion comment block in index.css, so its absence proves the
  // matches below come from real selectors, not from explanatory prose.
  it('comment strip ran (docs-only phrase absent)', () => {
    expect(code, 'comment strip did not run').not.toContain('usePreferencesStore');
    expect(code, 'selectors survive the strip').toContain(`[${DATA_THEME}='`);
  });

  it('every theme/density union member and the motion activation exist as CSS selectors', () => {
    for (const t of THEMES) {
      expect(code, `[data-theme='${t}'] selector missing from src/css`).toContain(
        `[${DATA_THEME}='${t}']`,
      );
    }
    for (const d of DENSITIES) {
      expect(code, `[data-density='${d}'] selector missing from src/css`).toContain(
        `[${DATA_DENSITY}='${d}']`,
      );
    }
    // The reduced-motion twin is the pairing this batch exists for: the JS
    // constant forces the string 'true' (themes.ts applyTokenAttributes) and
    // only `html[data-reduced-motion='true']` activates the CSS kill-switch.
    expect(code, `[${DATA_REDUCED_MOTION}='true'] selector missing`).toContain(
      `[${DATA_REDUCED_MOTION}='true']`,
    );
  });

  it('the CSS declares no selector values the TS unions do not know', () => {
    expect(cssSelectorValues(code, DATA_THEME)).toEqual([...THEMES].sort());
    expect(cssSelectorValues(code, DATA_DENSITY)).toEqual([...DENSITIES].sort());
    expect(cssSelectorValues(code, DATA_REDUCED_MOTION)).toEqual(['true']);
  });
});
