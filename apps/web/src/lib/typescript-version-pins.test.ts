// @vitest-environment node
/**
 * Tests for: TypeScript aligned on 6.0 in every workspace
 * Contract source: runs/run_20261107_174316/plan.md § Interface Contract → Test file: TypeScript version pins
 * Covers criteria: #1, #2, #4 (from prd.md)
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

const WORKSPACES: Array<[string, string]> = [
  ['.', 'package.json'],
  ['apps/api', 'apps/api/package.json'],
  ['apps/web', 'apps/web/package.json'],
  ['packages/shared', 'packages/shared/package.json'],
  ['scripts/import-catalog', 'scripts/import-catalog/package.json'],
];

function importerTypescript(
  lock: string,
  importer: string,
): { specifier: string; version: string } {
  const lines = lock.split(/\r?\n/);
  const start = lines.findIndex((l) => l === `  ${importer}:`);
  expect(start).toBeGreaterThanOrEqual(0);
  let end = lines.findIndex((l, i) => i > start && /^ {2}\S/.test(l));
  if (end === -1) end = lines.length;
  const block = lines.slice(start, end);
  const ts = block.findIndex((l) => l === '      typescript:');
  expect(ts).toBeGreaterThanOrEqual(0);
  return {
    specifier: (block[ts + 1] ?? '').replace(/^\s*specifier:\s*/, '').trim(),
    version: (block[ts + 2] ?? '').replace(/^\s*version:\s*/, '').trim(),
  };
}

describe('TypeScript aligned on 6.0', () => {
  it.each(WORKSPACES)('%s declares typescript ^6.0.3', (_importer, rel) => {
    const pkg = JSON.parse(read(rel)) as { devDependencies?: Record<string, string> };
    expect(pkg.devDependencies?.typescript).toBe('^6.0.3');
  });

  it.each(WORKSPACES)('lockfile importer %s resolves typescript to one 6.0.x', (importer) => {
    const lock = read('pnpm-lock.yaml');
    const { specifier, version } = importerTypescript(lock, importer);
    expect(specifier).toBe('^6.0.3');
    expect(version).toMatch(/^6\.0\.\d+$/);
    expect(version).toBe(importerTypescript(lock, '.').version);
  });
});
