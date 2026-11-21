// @vitest-environment node
/**
 * Tests for: render.yaml lists every env var the API needs
 * Contract source: runs/run_20261121_160034/plan.md § Interface Contract → render.yaml env vars
 *
 * CONTRACT_GAPs: none
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function renderLines(): string[] {
  return readFileSync(path.join(repoRoot, 'render.yaml'), 'utf8').split(/\r?\n/);
}

function keyLineIndexes(name: string): number[] {
  const re = new RegExp(`^\\s*-\\s*key:\\s*${name}\\s*$`);
  return renderLines().flatMap((line, i) => (re.test(line) ? [i] : []));
}

describe('render.yaml env vars', () => {
  it.each(['FRONTEND_URL', 'EMAIL_FROM', 'RESEND_API_KEY', 'CORS_ORIGIN'])(
    'lists %s once as sync: false',
    (name) => {
      const idx = keyLineIndexes(name);
      expect(idx).toHaveLength(1);
      expect(renderLines()[idx[0] + 1]).toMatch(/^\s*sync:\s*false\s*$/);
    },
  );

  it('still generates JWT_SECRET', () => {
    const idx = keyLineIndexes('JWT_SECRET');
    expect(idx).toHaveLength(1);
    expect(renderLines()[idx[0] + 1]).toMatch(/^\s*generateValue:\s*true\s*$/);
  });

  it('still sets TRUST_PROXY_HOPS to 1', () => {
    const idx = keyLineIndexes('TRUST_PROXY_HOPS');
    expect(idx).toHaveLength(1);
    expect(renderLines()[idx[0] + 1]).toMatch(/^\s*value:\s*['"]?1['"]?\s*$/);
  });
});
