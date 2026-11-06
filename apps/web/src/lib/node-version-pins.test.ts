// @vitest-environment node
/**
 * Tests for: Node major pinned to 26 on every platform
 * Contract source: runs/run_20261106_223354/plan.md § Interface Contract → Test file: Node version pins
 * Covers criteria: #1, #2, #3, #4, #5 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

describe('Node major pin', () => {
  it('.nvmrc is exactly 26 with at most one trailing newline', () => {
    expect(read('.nvmrc')).toMatch(/^26\r?\n?$/);
  });

  it('root package.json engines.node is ">=26 <27"', () => {
    const pkg = JSON.parse(read('package.json')) as { engines?: { node?: string } };
    expect(pkg.engines?.node).toBe('>=26 <27');
  });

  it('render.yaml NODE_VERSION value is 26', () => {
    const lines = read('render.yaml').split(/\r?\n/);
    const idx = lines.findIndex((l) => /key:\s*NODE_VERSION\s*$/.test(l));
    expect(idx).toBeGreaterThanOrEqual(0);
    const valueLine = lines[idx + 1] ?? '';
    expect(valueLine).toMatch(/^\s*value:\s*/);
    expect(stripQuotes(valueLine.replace(/^\s*value:\s*/, ''))).toBe('26');
  });

  it('ci.yml has node-version lines and every one is 26', () => {
    const versions = read('.github/workflows/ci.yml')
      .split(/\r?\n/)
      .filter((l) => /^\s*node-version:/.test(l))
      .map((l) => stripQuotes(l.replace(/^\s*node-version:\s*/, '')));
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) {
      expect(v).toBe('26');
    }
  });

  it.each(['apps/api/package.json', 'apps/web/package.json', 'scripts/import-catalog/package.json'])(
    '%s devDependencies @types/node is on major 26',
    (rel) => {
      const pkg = JSON.parse(read(rel)) as { devDependencies?: Record<string, string> };
      expect(pkg.devDependencies?.['@types/node']).toMatch(/^\^26\.\d+\.\d+$/);
    },
  );
});
