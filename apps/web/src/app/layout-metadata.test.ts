/**
 * Tests for: apps/web/src/app/layout.tsx metadataBase wiring (source-text checks)
 * Contract source: runs/run_20261121_160034/plan.md § Interface Contract → Root layout metadata
 *
 * RootLayout cannot be rendered under vitest, so this reads the source, like layout-locale.test.ts.
 *
 * CONTRACT_GAPs: none
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(path.join(here, 'layout.tsx'), 'utf-8');

describe('layout.tsx: metadataBase', () => {
  it('imports the siteMetadataBase helper', () => {
    expect(layoutSource).toContain("import { siteMetadataBase } from '@/lib/site-url';");
  });

  it('feeds NEXT_PUBLIC_SITE_URL through the helper', () => {
    expect(layoutSource).toContain('siteMetadataBase(process.env.NEXT_PUBLIC_SITE_URL)');
  });

  it('puts metadataBase inside the exported metadata object', () => {
    const match = /export const metadata[^=]*=\s*\{([\s\S]*?)\n\};/.exec(layoutSource);
    expect(match).not.toBeNull();
    expect(match?.[1]).toContain('metadataBase');
  });

  it('does not hard-code the domain or a literal base URL', () => {
    expect(layoutSource).not.toContain('coincompanion');
    expect(layoutSource).not.toContain("new URL('http");
  });
});
