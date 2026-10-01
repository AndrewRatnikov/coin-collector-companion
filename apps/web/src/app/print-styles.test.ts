/**
 * Tests for: apps/web/src/app/globals.css print rules
 * Contract source: runs/run_20261001_205959/plan.md § Interface Contract → Stylesheet: print rules
 * Covers criteria: #12 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const globalsCss = readFileSync(path.join(here, 'globals.css'), 'utf-8');

/** Returns the body of the first `@media print { ... }` block using brace matching. */
function extractPrintBlock(css: string): string | null {
  const start = css.search(/@media\s+print\s*\{/);
  if (start === -1) return null;
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

/** Splits a block body into { selectors, declarations } rules (no nesting expected). */
function parseRules(body: string): { selectors: string[]; declarations: string }[] {
  const rules: { selectors: string[]; declarations: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    rules.push({
      selectors: m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      declarations: m[2],
    });
  }
  return rules;
}

describe('globals.css @media print', () => {
  const block = extractPrintBlock(globalsCss);

  it('contains an @media print block', () => {
    expect(block).not.toBeNull();
  });

  it('hides nav, footer and button with display: none !important', () => {
    const rules = parseRules(block ?? '');
    const hiding = rules.filter((r) => /display:\s*none\s*!important/.test(r.declarations));
    const hiddenSelectors = hiding.flatMap((r) => r.selectors);

    expect(hiddenSelectors).toContain('nav');
    expect(hiddenSelectors).toContain('footer');
    expect(hiddenSelectors).toContain('button');
  });

  it('mentions nav, footer, button and display none in the print block text', () => {
    expect(block).toMatch(/\bnav\b/);
    expect(block).toMatch(/\bfooter\b/);
    expect(block).toMatch(/\bbutton\b/);
    expect(block).toMatch(/display:\s*none/);
  });

  it('does not hide main, table, h1 or p', () => {
    const rules = parseRules(block ?? '');
    const hiddenSelectors = rules
      .filter((r) => /display:\s*none/.test(r.declarations))
      .flatMap((r) => r.selectors);

    for (const kept of ['main', 'table', 'h1', 'p', 'body', 'html']) {
      expect(hiddenSelectors).not.toContain(kept);
    }
  });

  it('keeps the existing design tokens untouched', () => {
    expect(globalsCss).toMatch(/--color-bg:\s*#f3f2f2/);
    expect(globalsCss).toMatch(/--color-accent:\s*#b68235/);
  });
});
