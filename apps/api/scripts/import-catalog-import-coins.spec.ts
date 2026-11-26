/**
 * Tests for: scripts/import-catalog/import-coins.ts
 * Contract source: runs/run_20261126_213654/plan.md § Interface Contract
 *                  (Module: import-coins, Docs needles)
 *
 * CONTRACT_GAPs: none
 *
 * Prisma is a plain mock; node:fs readFileSync is mocked for fixture reads. The docs
 * assertions read repo markdown through the real fs (jest.requireActual), which is the
 * documented way to check the docs needles.
 */

import type { CoinImportConflict } from '../../../scripts/import-catalog/lib/plan';
import {
  EXISTING_COIN_SELECT,
  formatConflict,
  formatFileSummary,
  importFixtureFile,
  main,
  parseImportArgs,
  runImport,
} from '../../../scripts/import-catalog/import-coins';
import type {
  FileImportResult,
  ImportPrismaClient,
} from '../../../scripts/import-catalog/import-coins';

jest.mock('node:fs', () => ({
  ...jest.requireActual<typeof import('node:fs')>('node:fs'),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  existsSync: jest.fn(() => false),
}));

import { readFileSync } from 'node:fs';

const actualFs = jest.requireActual<typeof import('node:fs')>('node:fs');
const mockedReadFileSync = readFileSync as unknown as jest.Mock;

const REPO_ROOT = `${__dirname}/../../..`;

interface Fixture {
  country: string;
  denomination: string;
  name: string;
  specs: { diameterMm: number; weightG: number; thicknessMm: number; material: string };
  coins: { year: number; mintMark: string; variety: string }[];
}

function fixture(years: number[], denomination = 'Cent', name = 'Lincoln Cent'): Fixture {
  return {
    country: 'USA',
    denomination,
    name,
    specs: { diameterMm: 19, weightG: 3.11, thicknessMm: 1.55, material: 'Bronze' },
    coins: years.map((year) => ({ year, mintMark: '', variety: '' })),
  };
}

function storedRow(
  year: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: `coin-${year}`,
    status: 'approved',
    country: 'USA',
    denomination: 'Cent',
    year,
    mintMark: '',
    variety: '',
    name: 'Lincoln Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: 19,
    weightG: 3.11,
    thicknessMm: 1.55,
    material: 'Bronze',
    mintage: null,
    isKeyDate: false,
    ...overrides,
  };
}

function makeMock(): {
  prisma: ImportPrismaClient;
  findMany: jest.Mock;
  transaction: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
} {
  const findMany = jest.fn();
  const createMany = jest.fn(({ data }: { data: unknown[] }) => Promise.resolve({ count: data.length }));
  const update = jest.fn().mockResolvedValue({});
  const tx = { coin: { createMany, update } };
  const transaction = jest.fn((callback: (t: typeof tx) => Promise<unknown>) => callback(tx));
  const prisma = { coin: { findMany }, $transaction: transaction } as unknown as ImportPrismaClient;
  return { prisma, findMany, transaction, createMany, update };
}

function serveFixtures(files: Record<string, Fixture>): void {
  mockedReadFileSync.mockImplementation((path: string) => {
    if (path in files) return JSON.stringify(files[path]);
    throw new Error(`unexpected read ${path}`);
  });
}

describe('import-coins', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockedReadFileSync.mockReset();
  });

  describe('EXISTING_COIN_SELECT', () => {
    it('selects status and never the submitter', () => {
      expect(EXISTING_COIN_SELECT.status).toBe(true);
      expect(EXISTING_COIN_SELECT.id).toBe(true);
      expect(Object.keys(EXISTING_COIN_SELECT)).not.toContain('submittedByUserId');
    });
  });

  describe('parseImportArgs', () => {
    it('drops a bare --, sets check, and keeps paths', () => {
      expect(parseImportArgs(['--', '--check', 'a.json'])).toEqual({
        check: true,
        fixtureArgs: ['a.json'],
      });
    });

    it('defaults to no check and no paths', () => {
      expect(parseImportArgs([])).toEqual({ check: false, fixtureArgs: [] });
    });

    it('keeps paths in order without --check, and accepts --check twice or after a path', () => {
      expect(parseImportArgs(['b.json', 'a.json'])).toEqual({
        check: false,
        fixtureArgs: ['b.json', 'a.json'],
      });
      expect(parseImportArgs(['a.json', '--check', '--check'])).toEqual({
        check: true,
        fixtureArgs: ['a.json'],
      });
    });

    it('throws on an unknown option, naming it', () => {
      expect(() => parseImportArgs(['--bogus'])).toThrow(/^Unknown option: --bogus/);
      expect(() => parseImportArgs(['a.json', '--dry-run'])).toThrow('--dry-run');
    });
  });

  describe('formatConflict and formatFileSummary', () => {
    const conflict: CoinImportConflict = {
      key: { country: 'USA', denomination: 'Cent', year: 1909, mintMark: '', variety: 'VDB' },
      id: 'coin-9',
      status: 'pending',
    };

    it('formats a conflict line exactly', () => {
      expect(formatConflict(conflict)).toBe(
        'conflict: USA Cent 1909 mintMark="" variety="VDB" id=coin-9 status=pending: not approved, left untouched',
      );
    });

    it('reflects different ids and statuses', () => {
      const other = formatConflict({
        key: { ...conflict.key, year: 1910, mintMark: 'S', variety: '' },
        id: 'coin-10',
        status: 'rejected',
      });
      expect(other).toBe(
        'conflict: USA Cent 1910 mintMark="S" variety="" id=coin-10 status=rejected: not approved, left untouched',
      );
    });

    const result: FileImportResult = {
      name: 'Lincoln Cent',
      filePath: '/x/f.json',
      created: 1,
      updated: 0,
      unchanged: 2,
      conflicts: [conflict],
      total: 4,
    };

    it('formats the per-file line with a [check] prefix only in check mode', () => {
      expect(formatFileSummary(result, true)).toBe(
        '[check] Lincoln Cent (/x/f.json): 1 created, 0 updated, 2 unchanged, 1 conflicts, 4 total',
      );
      expect(formatFileSummary(result, false)).toBe(
        'Lincoln Cent (/x/f.json): 1 created, 0 updated, 2 unchanged, 1 conflicts, 4 total',
      );
    });
  });

  describe('importFixtureFile', () => {
    const path = '/fx/cent.json';

    it('queries existing coins with the select and writes everything but the conflict', async () => {
      serveFixtures({ [path]: fixture([1909, 1910, 1911, 1912]) });
      const { prisma, findMany, transaction, createMany, update } = makeMock();
      findMany.mockResolvedValue([
        storedRow(1910, { name: 'Old Name' }),
        storedRow(1911),
        storedRow(1912, { status: 'pending', name: 'User Submission' }),
      ]);

      const result = await importFixtureFile(prisma, path, { check: false });

      expect(findMany).toHaveBeenCalledWith({
        where: { country: 'USA', denomination: 'Cent' },
        select: EXISTING_COIN_SELECT,
      });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(createMany).toHaveBeenCalledTimes(1);
      const created = (createMany.mock.calls[0][0] as { data: { year: number }[] }).data;
      expect(created.map((r) => r.year)).toEqual([1909]);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith({ where: { id: 'coin-1910' }, data: { name: 'Lincoln Cent' } });
      expect(update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'coin-1912' } }),
      );
      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.unchanged).toBe(1);
      expect(result.total).toBe(4);
      expect(result.conflicts).toEqual([
        {
          key: { country: 'USA', denomination: 'Cent', year: 1912, mintMark: '', variety: '' },
          id: 'coin-1912',
          status: 'pending',
        },
      ]);
      expect(warnSpy).toHaveBeenCalledWith(formatConflict(result.conflicts[0]));
      expect(logSpy).toHaveBeenCalledWith(formatFileSummary(result, false));
      expect(logSpy.mock.calls.flat().join('\n')).toContain('1 conflicts');
    });

    it('treats a rejected row as a conflict too, and writes nothing when only conflicts and unchanged remain', async () => {
      serveFixtures({ [path]: fixture([1911, 1912]) });
      const { prisma, findMany, transaction, createMany, update } = makeMock();
      findMany.mockResolvedValue([storedRow(1911), storedRow(1912, { status: 'rejected' })]);

      const first = await importFixtureFile(prisma, path, { check: false });
      const second = await importFixtureFile(prisma, path, { check: false });

      expect(transaction).not.toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(first.conflicts).toHaveLength(1);
      expect(first.conflicts[0].status).toBe('rejected');
      expect(second).toEqual(first);
    });

    it('check mode opens no transaction and writes nothing, counting planned creates', async () => {
      serveFixtures({ [path]: fixture([1909, 1910, 1911, 1912]) });
      const { prisma, findMany, transaction, createMany, update } = makeMock();
      findMany.mockResolvedValue([
        storedRow(1910, { name: 'Old Name' }),
        storedRow(1911),
        storedRow(1912, { status: 'pending' }),
      ]);

      const result = await importFixtureFile(prisma, path, { check: true });

      expect(transaction).not.toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.unchanged).toBe(1);
      expect(result.conflicts).toHaveLength(1);
      expect(result.total).toBe(4);
      expect(logSpy).toHaveBeenCalledWith(formatFileSummary(result, true));
      expect(String(logSpy.mock.calls[0][0])).toMatch(/^\[check\] /);
    });

    it('check mode counts differ with the fixture (two creates versus one)', async () => {
      serveFixtures({ [path]: fixture([1909, 1910, 1911]) });
      const { prisma, findMany } = makeMock();
      findMany.mockResolvedValue([storedRow(1911)]);

      const result = await importFixtureFile(prisma, path, { check: true });

      expect(result.created).toBe(2);
      expect(result.unchanged).toBe(1);
      expect(result.conflicts).toEqual([]);
      expect(result.total).toBe(3);
    });

    it('prints no submitter data in conflict output', async () => {
      serveFixtures({ [path]: fixture([1912]) });
      const { prisma, findMany } = makeMock();
      findMany.mockResolvedValue([storedRow(1912, { status: 'pending', submittedByUserId: 'user-secret-1' })]);

      await importFixtureFile(prisma, path, { check: true });

      const output = [...warnSpy.mock.calls, ...logSpy.mock.calls, ...errorSpy.mock.calls]
        .flat()
        .join('\n');
      expect(output).not.toContain('user-secret-1');
      expect(output).not.toContain('submittedByUserId');
    });
  });

  describe('runImport', () => {
    const a = '/fx/a.json';
    const b = '/fx/b.json';

    it('returns 1 when any file has a conflict, still processing every file, and says how to resolve it', async () => {
      serveFixtures({ [a]: fixture([1912]), [b]: fixture([1911], 'Dime', 'Roosevelt Dime') });
      const { prisma, findMany } = makeMock();
      findMany
        .mockResolvedValueOnce([storedRow(1912, { status: 'pending' })])
        .mockResolvedValueOnce([]);

      const code = await runImport(prisma, [a, b], { check: false });

      expect(code).toBe(1);
      expect(findMany).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0][0])).toContain('/admin/submissions');
    });

    it('returns 0 and prints no end-of-run notice when there are no conflicts', async () => {
      serveFixtures({ [a]: fixture([1911]), [b]: fixture([1910]) });
      const { prisma, findMany } = makeMock();
      findMany.mockResolvedValue([storedRow(1911)]);

      const code = await runImport(prisma, [a, b], { check: false });

      expect(code).toBe(0);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('returns 1 in check mode when a conflict exists', async () => {
      serveFixtures({ [a]: fixture([1912]) });
      const { prisma, findMany } = makeMock();
      findMany.mockResolvedValue([storedRow(1912, { status: 'rejected' })]);

      expect(await runImport(prisma, [a], { check: true })).toBe(1);
    });

    it('rejects when a query throws, and stops later files', async () => {
      serveFixtures({ [a]: fixture([1911]), [b]: fixture([1911]) });
      const { prisma, findMany } = makeMock();
      findMany.mockRejectedValueOnce(new Error('db down'));

      await expect(runImport(prisma, [a, b], { check: false })).rejects.toThrow('db down');
      expect(findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('main', () => {
    it('rejects an unknown option before reading any fixture or querying', async () => {
      const { findMany } = makeMock();

      await expect(main(['--bogus'])).rejects.toThrow('--bogus');

      expect(mockedReadFileSync).not.toHaveBeenCalled();
      expect(findMany).not.toHaveBeenCalled();
    });
  });

  describe('docs', () => {
    const read = (relative: string): string =>
      actualFs.readFileSync(`${REPO_ROOT}/${relative}`, 'utf-8');
    const adrSlug = '2026-11-26-catalog-import-leaves-non-approved-coins-alone-as-conflicts';
    const oldSlug = '2026-11-21-catalog-import-diffs-per-file-and-writes-one-transaction';

    it('README documents conflicts, --check and human resolution', () => {
      const readme = read('scripts/import-catalog/README.md');
      for (const needle of [
        '--check',
        'conflict',
        'exit',
        '/admin/submissions',
        'approve',
        'reject',
        'N conflicts',
        '2026-10-02-submission-review-rules.md',
      ]) {
        expect(readme).toContain(needle);
      }
    });

    it('the new ADR has the repo format and the required content', () => {
      const adr = read(`docs/adr/${adrSlug}.md`);
      const lines = adr.split('\n');
      expect(lines).toContain('- **Status:** Accepted');
      expect(lines).toContain('- **Date:** 2026-11-26');
      expect(lines.some((l) => l.startsWith('- **Source:**') && l.includes('run_20261126_213654'))).toBe(true);
      expect(lines.some((l) => l.startsWith('- **Code:**'))).toBe(true);
      for (const heading of ['## Context', '## Decision', '## Alternatives considered', '## Consequences']) {
        expect(lines).toContain(heading);
      }
      for (const needle of ['--check', '2.9', 'pending manual pass', `${oldSlug}.md`]) {
        expect(adr).toContain(needle);
      }
    });

    it('the old ADR is amended, not superseded', () => {
      const old = read(`docs/adr/${oldSlug}.md`);
      const status = old.split('\n').find((l) => l.startsWith('- **Status:**')) ?? '';
      expect(status.startsWith('- **Status:** Accepted.')).toBe(true);
      expect(status).toContain(`(${adrSlug}.md)`);
      expect(status).not.toContain('Superseded');
      expect(old).toContain('## Decision');
    });

    it('the ADR index lists the new ADR and links the amendment from the old row', () => {
      const rows = read('docs/adr/README.md').split('\n');
      const newRow = rows.find((l) => l.includes(`](${adrSlug}.md)`));
      expect(newRow).toBeDefined();
      expect(newRow).toContain('Accepted');
      const oldRow = rows.find((l) => l.includes(`](${oldSlug}.md)`));
      expect(oldRow).toBeDefined();
      expect(oldRow).toContain(adrSlug);
    });

    it('history has the dated paragraph with the pending manual pass', () => {
      const line = read('docs/history.md')
        .split('\n')
        .find((l) => l.includes('**Catalog import conflicts with user submissions (2026-11-26), backlog_growth.md 2.9:**'));
      expect(line).toBeDefined();
      for (const needle of ['--check', '/admin/submissions', 'seed:canonical', 'pending manual pass', '2.9']) {
        expect(line).toContain(needle);
      }
    });
  });
});
