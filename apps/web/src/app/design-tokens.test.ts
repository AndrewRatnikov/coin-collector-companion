/**
 * Tests for: apps/web/src/app/globals.css + apps/web/src/app/layout.tsx
 * Contract source: runs/run_20260728_071525/plan.md § Interface Contract
 *                   runs/run_20261011_095624/plan.md § Interface Contract → Token: --color-danger
 *                   runs/run_20261017_142658/plan.md § Interface Contract → Tokens (globals.css)
 * Covers criteria: #1 (from prd.md) — global design tokens applied app-wide; #12 (run_20261011_095624) --color-danger;
 *                  #1, #2, #13, #15 (run_20261017_142658) danger/metal tokens, lining numerals, animations
 *
 * These two files carry no exports/props/testids (pure CSS + a font-loader swap in a
 * root layout), so there is nothing to render/mount here. Instead this reads both files'
 * real source text and asserts the required Classical tokens/fonts are actually present —
 * a real assertion that fails if the token/font wiring is missing, reverted, or renamed,
 * not a trivial "file exists" check.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(here); // this test file lives at apps/web/src/app/ once copied into the repo

const globalsCss = readFileSync(path.join(APP_DIR, 'globals.css'), 'utf-8');
const layoutTsx = readFileSync(path.join(APP_DIR, 'layout.tsx'), 'utf-8');

/** The text between the braces of the first plain `@theme { ... }` block (not `@theme inline`). */
function themeBlock(css: string): string {
  const match = /@theme\s*\{/.exec(css);
  if (!match) return '';
  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i);
    }
  }
  return css.slice(start);
}

/** The declarations of the top-level `body { ... }` rule. */
function bodyRule(css: string): string {
  const match = /(?:^|\n)body\s*\{([^}]*)\}/.exec(css);
  return match ? match[1] : '';
}

/** The declarations of the `h1, h2, h3, h4, h5, h6 { ... }` rule. */
function headingRule(css: string): string {
  const match = /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{([^}]*)\}/.exec(css);
  return match ? match[1] : '';
}

describe('Classical design tokens (globals.css)', () => {
  describe('criterion 1: global design tokens applied app-wide', () => {
    it('defines the Classical color tokens with their exact values', () => {
      expect(globalsCss).toMatch(/--color-bg:\s*#f3f2f2/);
      expect(globalsCss).toMatch(/--color-text:\s*#201f1d/);
      expect(globalsCss).toMatch(/--color-accent:\s*#b68235/);
      expect(globalsCss).toMatch(/--color-surface:\s*#eae9e9/);
    });

    it('no longer defines the legacy Next.js starter tokens', () => {
      expect(globalsCss).not.toMatch(/--background:\s*#ffffff/);
      expect(globalsCss).not.toMatch(/--foreground:\s*#171717/);
    });

    it('drops the dark-mode media query (Classical ships one fixed light theme)', () => {
      expect(globalsCss).not.toMatch(/prefers-color-scheme:\s*dark/);
    });

    it('defines --font-heading, --font-body, and --font-mono custom properties', () => {
      expect(globalsCss).toMatch(/--font-heading:/);
      expect(globalsCss).toMatch(/--font-body:/);
      expect(globalsCss).toMatch(/--font-mono:/);
    });
  });

  describe('run_20261011_095624 criterion 12: danger token', () => {
    it('defines --color-danger with its exact value inside the @theme block', () => {
      expect(globalsCss).toMatch(/--color-danger:\s*#a3271f/);

      const themeStart = globalsCss.indexOf('@theme');
      expect(themeStart).toBeGreaterThanOrEqual(0);
      const dangerIndex = globalsCss.search(/--color-danger:\s*#a3271f/);
      expect(dangerIndex).toBeGreaterThan(themeStart);
    });
  });

  describe('run_20261017_142658 criterion 1: danger and metal tokens', () => {
    const tokens: Array<[string, string]> = [
      ['--color-danger', '#a3271f'],
      ['--color-danger-bg', '#fbeceb'],
      ['--color-danger-line', '#e7b7b3'],
      ['--color-gold-1', '#ecd59a'],
      ['--color-gold-2', '#c9a55a'],
      ['--color-silver-1', '#dedcd8'],
      ['--color-silver-2', '#b3afa9'],
      ['--color-copper-1', '#dfae88'],
      ['--color-copper-2', '#b07651'],
    ];

    it.each(tokens)('defines %s as %s inside the plain @theme block', (name, value) => {
      const theme = themeBlock(globalsCss);
      expect(theme).not.toBe('');
      expect(theme).toMatch(new RegExp(`${name}:\\s*${value}`));
    });

    it('keeps each token distinct (no two metals share a value)', () => {
      const values = tokens.map(([, value]) => value);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('run_20261017_142658 criterion 2: lining numerals', () => {
    it('sets font-variant-numeric: lining-nums on body', () => {
      expect(bodyRule(globalsCss)).toMatch(/font-variant-numeric:\s*lining-nums/);
    });

    it('does not override font-variant-numeric on the h1-h6 rule, so Cormorant headings inherit lining figures', () => {
      const headings = headingRule(globalsCss);
      expect(headings).not.toBe('');
      expect(headings).toMatch(/font-family:/);
      expect(headings).not.toMatch(/font-variant-numeric/);
    });
  });

  describe('run_20261017_142658 criteria 13 and 15: animations', () => {
    it('defines --animate-skeleton as a 1.4s ease-in-out infinite pulse inside @theme', () => {
      expect(themeBlock(globalsCss)).toMatch(
        /--animate-skeleton:\s*skeleton-pulse\s+1\.4s\s+ease-in-out\s+infinite/,
      );
    });

    it('defines --animate-check-spin as a 0.8s linear infinite spin inside @theme', () => {
      expect(themeBlock(globalsCss)).toMatch(/--animate-check-spin:\s*check-spin\s+0\.8s\s+linear\s+infinite/);
    });

    it('defines the skeleton-pulse keyframes as a halfway dip to 0.5 opacity', () => {
      expect(globalsCss).toMatch(/@keyframes\s+skeleton-pulse\s*\{\s*50%\s*\{\s*opacity:\s*0\.5;?\s*\}/);
    });

    it('defines the check-spin keyframes as a full turn', () => {
      expect(globalsCss).toMatch(/@keyframes\s+check-spin\s*\{\s*to\s*\{\s*transform:\s*rotate\(360deg\);?\s*\}/);
    });

    it('does not copy the classical.css class or animation names into the app', () => {
      expect(globalsCss).not.toMatch(/\.ccard|\.coin\.gold|cc-pulse|cc-spin|--a100/);
    });
  });
});

describe('Classical font loaders (layout.tsx)', () => {
  describe('criterion 1: Cormorant Garamond / IBM Plex Sans / IBM Plex Mono replace Geist', () => {
    it('imports Cormorant_Garamond, IBM_Plex_Sans, and IBM_Plex_Mono from next/font/google', () => {
      const importLine = layoutTsx.match(/import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/);
      expect(importLine).not.toBeNull();
      const imported = importLine![1];
      expect(imported).toMatch(/Cormorant_Garamond/);
      expect(imported).toMatch(/IBM_Plex_Sans/);
      expect(imported).toMatch(/IBM_Plex_Mono/);
    });

    it('no longer imports Geist or Geist_Mono', () => {
      const importLine = layoutTsx.match(/import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/);
      expect(importLine).not.toBeNull();
      const imported = importLine![1];
      expect(imported).not.toMatch(/\bGeist\b/);
      expect(imported).not.toMatch(/Geist_Mono/);
    });

    it('applies all three font loader variables as classNames on the <html> element', () => {
      const htmlTag = layoutTsx.match(/<html[^>]*className=\{([^}]+)\}/);
      expect(htmlTag).not.toBeNull();
      const classNameExpr = htmlTag![1];
      expect(classNameExpr).toMatch(/\.variable/);
      // Three distinct font loader instances should each contribute their .variable
      const variableRefs = classNameExpr.match(/\.variable/g) ?? [];
      expect(variableRefs.length).toBeGreaterThanOrEqual(3);
    });
  });
});
