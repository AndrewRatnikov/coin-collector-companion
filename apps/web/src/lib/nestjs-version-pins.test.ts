// @vitest-environment node
/**
 * Tests for: NestJS 12 in apps/api (Phase 6 of 7)
 * Contract source: runs/run_20261107_181139/plan.md § Interface Contract → Test file: NestJS version pins
 * Covers criteria: #1, #2, #4, #5 (from prd.md)
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

interface ApiPackage {
  type?: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

function apiPackage(): ApiPackage {
  return JSON.parse(read('apps/api/package.json')) as ApiPackage;
}

const NEST_12: Array<[string, string]> = [
  ['@nestjs/common', '^12.3.2'],
  ['@nestjs/core', '^12.3.2'],
  ['@nestjs/platform-express', '^12.3.2'],
  ['@nestjs/testing', '^12.3.2'],
  ['@nestjs/swagger', '^12.0.5'],
  ['@nestjs/config', '^12.0.1'],
  ['@nestjs/jwt', '^12.0.3'],
  ['@nestjs/passport', '^12.0.0'],
  ['@nestjs/cli', '^12.0.11'],
  ['@nestjs/schematics', '^12.0.12'],
];

function apiImporterEntry(lock: string, name: string): { specifier: string; version: string } {
  const lines = lock.split(/\r?\n/);
  const start = lines.findIndex((l) => l === '  apps/api:');
  expect(start).toBeGreaterThanOrEqual(0);
  let end = lines.findIndex((l, i) => i > start && /^ {2}\S/.test(l));
  if (end === -1) end = lines.length;
  const block = lines.slice(start, end);
  const entry = block.findIndex((l) => l === `      '${name}':`);
  expect(entry).toBeGreaterThanOrEqual(0);
  return {
    specifier: (block[entry + 1] ?? '').replace(/^\s*specifier:\s*/, '').trim(),
    version: (block[entry + 2] ?? '').replace(/^\s*version:\s*/, '').trim(),
  };
}

function overridesSection(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l === 'overrides:');
  expect(start).toBeGreaterThanOrEqual(0);
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.length > 0 && !/^\s/.test(line)) break;
    if (line.trim() !== '') out.push(line);
  }
  return out;
}

function packageKeys(lock: string): string[] {
  const lines = lock.split(/\r?\n/);
  const start = lines.findIndex((l) => l === 'packages:');
  const end = lines.findIndex((l) => l === 'snapshots:');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return lines
    .slice(start + 1, end)
    .filter((l) => /^ {2}\S.*:$/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/:$/, '')
        .replace(/^'(.*)'$/, '$1'),
    );
}

describe('NestJS 12 in apps/api', () => {
  it.each(NEST_12)('apps/api/package.json declares %s %s', (name, range) => {
    const pkg = apiPackage();
    expect(pkg.dependencies[name] ?? pkg.devDependencies[name]).toBe(range);
  });

  it.each(NEST_12)('lockfile apps/api importer resolves %s to 12.x with %s', (name, range) => {
    const { specifier, version } = apiImporterEntry(read('pnpm-lock.yaml'), name);
    expect(specifier).toBe(range);
    expect(version).toMatch(/^12\.\d+\.\d+(\(|$)/);
  });

  it('keeps @nestjs/throttler on 6.x (no 12.x line exists)', () => {
    expect(apiPackage().dependencies['@nestjs/throttler']).toBe('^6.7.1');
    const { version } = apiImporterEntry(read('pnpm-lock.yaml'), '@nestjs/throttler');
    expect(version).toMatch(/^6\.\d+\.\d+\(/);
  });

  it('lockfile has no Nest 11 core packages and no typescript 5.x, only typescript 6.0.3', () => {
    const keys = packageKeys(read('pnpm-lock.yaml'));
    expect(keys.length).toBeGreaterThan(100);
    expect(keys.filter((k) => /^@nestjs\/(common|core|platform-express|testing|cli)@11\./.test(k))).toEqual(
      [],
    );
    expect(keys.filter((k) => /^typescript@5\./.test(k))).toEqual([]);
    expect(keys).toContain('typescript@6.0.3');
  });

  it('apps/api stays CommonJS (no "type" field)', () => {
    expect(apiPackage().type).toBeUndefined();
  });

  it('stays on Jest 30 and Prisma 6', () => {
    const pkg = apiPackage();
    expect(pkg.devDependencies.jest).toMatch(/^\^30\./);
    expect(pkg.devDependencies.prisma).toMatch(/^\^6\./);
    expect(pkg.dependencies['@prisma/client']).toMatch(/^\^6\./);
  });

  it.each([
    ['test', 'node --experimental-vm-modules ./node_modules/jest/bin/jest.js'],
    [
      'test:e2e',
      'node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ./test/jest-e2e.json',
    ],
  ])('script %s starts Jest through --experimental-vm-modules', (script, expected) => {
    expect(apiPackage().scripts[script]).toBe(expected);
  });

  it('pnpm-workspace.yaml overrides only deepmerge-ts (multer override removed)', () => {
    expect(overridesSection(read('pnpm-workspace.yaml'))).toEqual([
      "  'deepmerge-ts@<8.0.0': ^8.0.2",
    ]);
  });

  it('pnpm-lock.yaml overrides only deepmerge-ts', () => {
    expect(overridesSection(read('pnpm-lock.yaml'))).toEqual(['  deepmerge-ts@<8.0.0: ^8.0.2']);
  });

  it('keeps minimumReleaseAge at 10080', () => {
    expect(read('pnpm-workspace.yaml').split(/\r?\n/)).toContain('minimumReleaseAge: 10080');
  });
});
