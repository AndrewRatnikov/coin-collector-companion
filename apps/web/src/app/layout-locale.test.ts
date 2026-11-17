/**
 * Tests for: apps/web/src/app/layout.tsx (source-text checks)
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Root layout
 * Covers criteria: #6, #20 (from prd.md)
 *
 * Nothing renders RootLayout under vitest (it is an async server component reading next/headers), so
 * these checks read the source text, the same way design-tokens.test.ts does.
 *
 * CONTRACT_GAPs: none
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import enLanding from '@/lib/i18n/locales/en/landing';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(path.join(here, 'layout.tsx'), 'utf-8');

describe('layout.tsx: locale cookie on first paint', () => {
  it('imports cookies from next/headers', () => {
    expect(layoutSource).toContain("import { cookies } from 'next/headers';");
  });

  it('is an async default-exported RootLayout that awaits cookies()', () => {
    expect(layoutSource).toContain('export default async function RootLayout(');
    expect(layoutSource).toContain('await cookies()');
  });

  it('reads the locale cookie by its exported name and parses it with parseLocale', () => {
    expect(layoutSource).toContain('LOCALE_COOKIE_NAME');
    expect(layoutSource).toContain('parseLocale(');
  });

  it('sets html lang from the parsed locale, before className, and never hard-codes lang="en"', () => {
    expect(layoutSource).toMatch(/<html[^>]*lang=\{locale\}/);
    expect(layoutSource).toMatch(/<html\s+lang=\{locale\}\s+className=\{/);
    expect(layoutSource).not.toContain('lang="en"');
  });

  it('passes the same locale to the provider as initialLocale', () => {
    expect(layoutSource).toContain('<I18nProvider initialLocale={locale}>');
  });
});

describe('layout.tsx: metadata', () => {
  it('takes the description from the English landing.metaDescription', () => {
    expect(layoutSource).toContain("enLanding['landing.metaDescription']");
    expect(layoutSource).toContain('landing.metaDescription');
    expect(layoutSource).toContain('@/lib/i18n/locales/en/landing');
  });

  it('has an English meta description that is not the old placeholder copy', () => {
    expect(enLanding['landing.metaDescription']).toBe(
      'Free checklists for coin collectors. Mark what you own and see what you’re still missing.',
    );
  });
});
