// @vitest-environment node
/**
 * Tests for: Prisma 7 with the pg driver adapter (Phase 7 of 7)
 * Contract source: runs/run_20261108_081744/plan.md § Interface Contract → Test file: Prisma version pins
 * Covers criteria: #1, #2, #3, #4, #5, #9, #10 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

function lines(rel: string): string[] {
  return read(rel).split(/\r?\n/);
}

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const PRISMA_7: Array<[string, string, 'dependencies' | 'devDependencies']> = [
  ['apps/api', '@prisma/client', 'dependencies'],
  ['apps/api', '@prisma/adapter-pg', 'dependencies'],
  ['apps/api', 'prisma', 'devDependencies'],
  ['scripts/import-catalog', '@prisma/client', 'dependencies'],
  ['scripts/import-catalog', '@prisma/adapter-pg', 'dependencies'],
  ['scripts/import-catalog', 'prisma', 'devDependencies'],
];

function importerEntry(
  lock: string,
  importer: string,
  name: string,
): { specifier: string; version: string } {
  const all = lock.split(/\r?\n/);
  const start = all.findIndex((l) => l === `  ${importer}:`);
  expect(start).toBeGreaterThanOrEqual(0);
  let end = all.findIndex((l, i) => i > start && /^ {2}\S/.test(l));
  if (end === -1) end = all.length;
  const block = all.slice(start, end);
  const entry = block.findIndex((l) => l === `      '${name}':` || l === `      ${name}:`);
  expect(entry).toBeGreaterThanOrEqual(0);
  return {
    specifier: (block[entry + 1] ?? '').replace(/^\s*specifier:\s*/, '').trim(),
    version: (block[entry + 2] ?? '').replace(/^\s*version:\s*/, '').trim(),
  };
}

function packageKeys(lock: string): string[] {
  const all = lock.split(/\r?\n/);
  const start = all.findIndex((l) => l === 'packages:');
  const end = all.findIndex((l) => l === 'snapshots:');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return all
    .slice(start + 1, end)
    .filter((l) => /^ {2}\S.*:$/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/:$/, '')
        .replace(/^'(.*)'$/, '$1'),
    );
}

// The trimmed, whitespace-collapsed, non-comment lines inside `<header> {` ... `}` of schema.prisma.
function schemaBlock(header: string): string[] {
  const all = lines('apps/api/prisma/schema.prisma');
  const start = all.findIndex((l) => l === `${header} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = all.findIndex((l, i) => i > start && l === '}');
  expect(end).toBeGreaterThan(start);
  return all
    .slice(start + 1, end)
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l !== '' && !l.startsWith('//'));
}

function sectionLines(rel: string, header: string): string[] {
  const all = lines(rel);
  const start = all.findIndex((l) => l === header);
  expect(start).toBeGreaterThanOrEqual(0);
  const out: string[] = [];
  for (const line of all.slice(start + 1)) {
    if (line.length > 0 && !/^\s/.test(line)) break;
    if (line.trim() !== '') out.push(line);
  }
  return out;
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'generated', 'coverage']);

function sourceFiles(rel: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(repoRoot, rel), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...sourceFiles(child));
    } else if (entry.name.endsWith('.ts')) {
      out.push(child);
    }
  }
  return out;
}

describe('Prisma 7 with the pg driver adapter', () => {
  it.each(PRISMA_7)('%s/package.json declares %s ^7.10.1 in %s', (dir, name, field) => {
    const pkg = JSON.parse(read(`${dir}/package.json`)) as Manifest;
    expect(pkg[field]?.[name]).toBe('^7.10.1');
  });

  it.each(PRISMA_7)('lockfile importer %s resolves %s to 7.10.1', (dir, name) => {
    const { specifier, version } = importerEntry(read('pnpm-lock.yaml'), dir, name);
    expect(specifier).toBe('^7.10.1');
    expect(version).toMatch(/^7\.10\.1(\(|$)/);
  });

  it('lockfile has Prisma 7.10.1 and no Prisma 6 or deepmerge-ts 7 package', () => {
    const keys = packageKeys(read('pnpm-lock.yaml'));
    expect(keys.length).toBeGreaterThan(100);
    expect(keys).toEqual(
      expect.arrayContaining([
        'prisma@7.10.1',
        '@prisma/client@7.10.1',
        '@prisma/adapter-pg@7.10.1',
      ]),
    );
    expect(keys.filter((k) => /^(prisma|@prisma\/(client|config|engines))@6\./.test(k))).toEqual(
      [],
    );
    expect(keys.filter((k) => /^deepmerge-ts@[0-7]\./.test(k))).toEqual([]);
  });

  it('pnpm-workspace.yaml and pnpm-lock.yaml have no overrides section', () => {
    expect(lines('pnpm-workspace.yaml')).not.toContain('overrides:');
    expect(lines('pnpm-lock.yaml')).not.toContain('overrides:');
  });

  it('allowBuilds runs the Prisma CLI and engines scripts, and @prisma/client has none', () => {
    const allow = sectionLines('pnpm-workspace.yaml', 'allowBuilds:');
    expect(allow).toEqual(
      expect.arrayContaining([
        "  '@prisma/client': false",
        "  '@prisma/engines': true",
        '  prisma: true',
      ]),
    );
  });

  it('schema.prisma uses the prisma-client generator with an explicit CommonJS output', () => {
    expect(schemaBlock('generator client')).toEqual([
      'provider = "prisma-client"',
      'output = "../src/generated/prisma"',
      'moduleFormat = "cjs"',
      'importFileExtension = ""',
    ]);
  });

  it('schema.prisma datasource holds no connection URL', () => {
    expect(schemaBlock('datasource db')).toEqual(['provider = "postgresql"']);
  });

  it('apps/api/prisma.config.ts sets the schema, migrations path and DATABASE_URL', () => {
    const config = read('apps/api/prisma.config.ts');
    expect(config).toContain("from 'prisma/config'");
    expect(config).toContain("schema: 'prisma/schema.prisma'");
    expect(config).toContain("path: 'prisma/migrations'");
    expect(config).toContain('url: process.env.DATABASE_URL');
  });

  it('the generated client folder is git-ignored', () => {
    expect(lines('.gitignore')).toContain('apps/api/src/generated/');
  });

  it('PrismaService connects through PrismaPg built from DATABASE_URL', () => {
    const service = read('apps/api/src/prisma/prisma.service.ts');
    expect(service).toContain("from '../generated/prisma/client'");
    expect(service).toContain("from '@prisma/adapter-pg'");
    expect(service).toContain('new PrismaPg({ connectionString: process.env.DATABASE_URL })');
  });

  it('no api or import-catalog source imports the Prisma 6 @prisma/client entry point', () => {
    const files = [
      ...sourceFiles('apps/api/src'),
      ...sourceFiles('apps/api/scripts'),
      ...sourceFiles('apps/api/test'),
      ...sourceFiles('scripts/import-catalog'),
    ];
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((f) =>
      /from '@prisma\/client'|require\('@prisma\/client'\)/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });
});
