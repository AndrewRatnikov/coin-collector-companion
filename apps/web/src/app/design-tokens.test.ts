/**
 * Tests for: apps/web/src/app/globals.css + apps/web/src/app/layout.tsx
 * Contract source: runs/run_20260728_071525/plan.md § Interface Contract
 * Covers criteria: #1 (from prd.md) — global design tokens applied app-wide
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

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(here); // this test file lives at apps/web/src/app/ once copied into the repo

const globalsCss = readFileSync(path.join(APP_DIR, 'globals.css'), 'utf-8');
const layoutTsx = readFileSync(path.join(APP_DIR, 'layout.tsx'), 'utf-8');

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
