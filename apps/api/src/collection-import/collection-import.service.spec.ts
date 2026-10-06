/**
 * Tests for: CollectionImportService
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (Service: collection-import.service.ts)
 * Covers criteria: #2, #3, #4, #5, #6, #9, #11, #13, #22 (from runs/run_20261005_212015/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely. Every write method the plan lists is provided as a jest.fn() so the
 * tests can prove that preview() calls none of them and confirm() calls only ownership.createMany.
 * No real DB or network.
 */

import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROWS } from '@coin-collector/shared';
import { CollectionImportService, type UploadedCsvFile } from './collection-import.service';
import { PrismaService } from '../prisma/prisma.service';

const COIN_1909_S_VDB = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const COIN_1909_S = '9b2e5c1a-7d4f-4b8e-9a3c-1f2e3d4c5b6a';
const COIN_1950_D = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

function catalogRow(
  id: string,
  year: number,
  mintMark: string,
  variety: string,
  country = 'USA',
  denomination = 'Cent',
) {
  return {
    id,
    country,
    denomination,
    year,
    mintMark,
    variety,
    name: `${country} ${denomination} ${year}${mintMark}${variety}`,
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: null,
    weightG: null,
    thicknessMm: null,
    material: null,
    mintage: null,
    isKeyDate: false,
    status: 'approved',
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

const CATALOG_ROWS = [
  catalogRow(COIN_1909_S_VDB, 1909, 'S', 'VDB'),
  catalogRow(COIN_1909_S, 1909, 'S', ''),
  catalogRow(COIN_1950_D, 1950, 'D', ''),
];

function csvFile(text: string, overrides: Partial<UploadedCsvFile> = {}): UploadedCsvFile {
  const buffer = Buffer.from(text, 'utf8');
  return { buffer, size: buffer.length, originalname: 'coins.csv', mimetype: 'text/csv', ...overrides };
}

function makePrismaMock() {
  return {
    coin: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    ownership: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    userSet: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    userSetCoin: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  };
}

type PrismaMock = ReturnType<typeof makePrismaMock>;

function expectNoWritesExcept(prisma: PrismaMock, allowed: jest.Mock[] = []) {
  const writes: Array<[string, jest.Mock]> = [
    ['coin.create', prisma.coin.create],
    ['coin.createMany', prisma.coin.createMany],
    ['coin.update', prisma.coin.update],
    ['coin.updateMany', prisma.coin.updateMany],
    ['coin.upsert', prisma.coin.upsert],
    ['coin.delete', prisma.coin.delete],
    ['coin.deleteMany', prisma.coin.deleteMany],
    ['ownership.createMany', prisma.ownership.createMany],
    ['ownership.create', prisma.ownership.create],
    ['ownership.upsert', prisma.ownership.upsert],
    ['ownership.update', prisma.ownership.update],
    ['ownership.updateMany', prisma.ownership.updateMany],
    ['ownership.delete', prisma.ownership.delete],
    ['ownership.deleteMany', prisma.ownership.deleteMany],
    ['userSet.create', prisma.userSet.create],
    ['userSet.createMany', prisma.userSet.createMany],
    ['userSet.update', prisma.userSet.update],
    ['userSet.updateMany', prisma.userSet.updateMany],
    ['userSet.upsert', prisma.userSet.upsert],
    ['userSet.delete', prisma.userSet.delete],
    ['userSet.deleteMany', prisma.userSet.deleteMany],
    ['userSetCoin.create', prisma.userSetCoin.create],
    ['userSetCoin.createMany', prisma.userSetCoin.createMany],
    ['userSetCoin.update', prisma.userSetCoin.update],
    ['userSetCoin.updateMany', prisma.userSetCoin.updateMany],
    ['userSetCoin.upsert', prisma.userSetCoin.upsert],
    ['userSetCoin.delete', prisma.userSetCoin.delete],
    ['userSetCoin.deleteMany', prisma.userSetCoin.deleteMany],
    ['$transaction', prisma.$transaction],
    ['$executeRaw', prisma.$executeRaw],
  ];
  const called = writes.filter(([, fn]) => !allowed.includes(fn) && fn.mock.calls.length > 0).map(([name]) => name);
  expect(called).toEqual([]);
}

describe('CollectionImportService', () => {
  let service: CollectionImportService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = makePrismaMock();
    prisma.coin.findMany.mockResolvedValue(CATALOG_ROWS);
    prisma.ownership.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [CollectionImportService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CollectionImportService);
  });

  describe('preview: input validation (criteria #9, #11)', () => {
    it('rejects a missing file with BadRequestException(IMPORT_FILE_REQUIRED) and reads nothing', async () => {
      const promise = service.preview('user-1', undefined, undefined);
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toMatchObject({ message: 'IMPORT_FILE_REQUIRED' });
      expect(prisma.coin.findMany).not.toHaveBeenCalled();
      expectNoWritesExcept(prisma);
    });

    it('rejects a file larger than IMPORT_MAX_FILE_BYTES with PayloadTooLargeException(IMPORT_FILE_TOO_LARGE)', async () => {
      const file = csvFile('Year,Country,Denomination\n1950,USA,Cent\n', { size: IMPORT_MAX_FILE_BYTES + 1 });
      const promise = service.preview('user-1', file, undefined);
      await expect(promise).rejects.toBeInstanceOf(PayloadTooLargeException);
      await expect(promise).rejects.toMatchObject({ message: 'IMPORT_FILE_TOO_LARGE' });
      expect(prisma.coin.findMany).not.toHaveBeenCalled();
    });

    it('accepts a file of exactly IMPORT_MAX_FILE_BYTES (boundary)', async () => {
      const file = csvFile('Year,Country,Denomination\n1950,USA,Cent\n', { size: IMPORT_MAX_FILE_BYTES });
      const result = await service.preview('user-1', file, undefined);
      expect(result.rows).toHaveLength(1);
    });

    it.each([
      ['an empty file', Buffer.alloc(0), 'IMPORT_EMPTY'],
      ['a binary file (NUL bytes)', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x01]), 'IMPORT_NOT_CSV'],
      ['a non-UTF-8 file', Buffer.from([0x59, 0x65, 0x61, 0x72, 0x2c, 0xe9, 0x0a, 0x31]), 'IMPORT_NOT_UTF8'],
      ['a header-only file', Buffer.from('Year,Country,Denomination\n', 'utf8'), 'IMPORT_NO_DATA_ROWS'],
      ['blank lines only', Buffer.from('\n\n\n', 'utf8'), 'IMPORT_EMPTY'],
    ])('maps %s to BadRequestException(%s)', async (_label, buffer, code) => {
      const file: UploadedCsvFile = { buffer, size: buffer.length, originalname: 'x.csv', mimetype: 'text/csv' };
      const promise = service.preview('user-1', file, undefined);
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toMatchObject({ message: code });
      expectNoWritesExcept(prisma);
    });

    it('rejects more than IMPORT_MAX_ROWS data rows with IMPORT_TOO_MANY_ROWS and accepts exactly the limit', async () => {
      const header = 'Year,Country,Denomination\n';
      const rowsOf = (n: number) => Array.from({ length: n }, () => '1950,USA,Cent').join('\n');

      const tooMany = service.preview('user-1', csvFile(header + rowsOf(IMPORT_MAX_ROWS + 1)), undefined);
      await expect(tooMany).rejects.toBeInstanceOf(BadRequestException);
      await expect(tooMany).rejects.toMatchObject({ message: 'IMPORT_TOO_MANY_ROWS' });

      const ok = await service.preview('user-1', csvFile(header + rowsOf(IMPORT_MAX_ROWS)), undefined);
      expect(ok.rows).toHaveLength(IMPORT_MAX_ROWS);
      expect(ok.summary.total).toBe(IMPORT_MAX_ROWS);
    });

    it.each(['not json', '{"year":0,"country":0}', '{"price":1}', '{"year":9}'])(
      'rejects the invalid mapping %j with IMPORT_INVALID_MAPPING',
      async (mapping) => {
        const file = csvFile('Year,Country,Denomination\n1950,USA,Cent\n');
        const promise = service.preview('user-1', file, mapping);
        await expect(promise).rejects.toBeInstanceOf(BadRequestException);
        await expect(promise).rejects.toMatchObject({ message: 'IMPORT_INVALID_MAPPING' });
      },
    );
  });

  describe('preview: result (criteria #13, #22)', () => {
    it('parses, suggests a mapping, matches against the catalog and summarises', async () => {
      const file = csvFile(
        'Year,Country,Denomination,Mint Mark,Variety,Notes\n' +
          '1909,USA,Cent,S,VDB,keeper\n' +
          '1950,United States,1 cent,D,,\n' +
          '1960,USA,Cent,D,,\n',
      );
      const result = await service.preview('user-1', file, undefined);

      expect(result.headers).toEqual(['Year', 'Country', 'Denomination', 'Mint Mark', 'Variety', 'Notes']);
      expect(result.delimiter).toBe(',');
      expect(result.mapping).toEqual({ year: 0, country: 1, denomination: 2, mintMark: 3, variety: 4 });
      expect(result.rows).toHaveLength(3);
      expect(result.rows.map((r) => r.line)).toEqual([2, 3, 4]);
      expect(result.rows.map((r) => r.status)).toEqual(['matched', 'matched', 'unmatched']);
      expect(result.rows[0].coin?.id).toBe(COIN_1909_S_VDB);
      expect(result.rows[1].coin?.id).toBe(COIN_1950_D);
      expect(result.rows[2].reason).toBe('no_such_coin');
      expect(result.summary).toMatchObject({ total: 3, matched: 2, unmatched: 1, ambiguous: 0, invalid: 0, toImport: 2 });
    });

    it('uses the semicolon delimiter and a supplied mapping instead of the suggested one', async () => {
      // Header names would suggest nothing useful; the explicit mapping tells the server which column is which.
      const file = csvFile('a;b;c\nUSA;Cent;1950\nUSA;Cent;1909\n');
      const mapping = JSON.stringify({ country: 0, denomination: 1, year: 2 });
      const result = await service.preview('user-1', file, mapping);

      expect(result.delimiter).toBe(';');
      expect(result.mapping).toEqual({ country: 0, denomination: 1, year: 2 });
      expect(result.rows[0].status).toBe('matched');
      expect(result.rows[0].coin?.id).toBe(COIN_1950_D);
      expect(result.rows[0].values).toEqual(['USA', 'Cent', '1950']);
    });

    it('falls back to the suggested mapping when the mapping field is empty', async () => {
      const file = csvFile('Year,Country,Denomination\n1950,USA,Cent\n');
      const result = await service.preview('user-1', file, '');
      expect(result.mapping).toEqual({ year: 0, country: 1, denomination: 2 });
    });

    it('a different explicit mapping produces a different result for the same file', async () => {
      const file = csvFile('Year,Country,Denomination\n1950,USA,Cent\n');
      const suggested = await service.preview('user-1', file, undefined);
      const swapped = await service.preview('user-1', file, JSON.stringify({ year: 2, country: 1, denomination: 0 }));
      expect(suggested.rows[0].status).toBe('matched');
      expect(swapped.rows[0].status).toBe('invalid');
      expect(swapped.rows[0].reason).toBe('year_invalid');
    });

    it('flags coins the user already owns using ownership.findMany', async () => {
      prisma.ownership.findMany.mockResolvedValue([{ coinId: COIN_1950_D }]);
      const file = csvFile('Year,Country,Denomination,Mint\n1950,USA,Cent,D\n1909,USA,Cent,S\n');
      const result = await service.preview('user-1', file, undefined);

      expect(result.rows[0].coin?.id).toBe(COIN_1950_D);
      expect(result.rows[0].alreadyOwned).toBe(true);
      expect(result.rows[0].coin?.owned).toBe(true);
      expect(result.summary.alreadyOwned).toBe(1);
      expect(result.summary.toImport).toBe(result.summary.matched - 1);
    });

    it('does not leak catalog-only fields into the response coins', async () => {
      const file = csvFile('Year,Country,Denomination,Mint\n1950,USA,Cent,D\n');
      const result = await service.preview('user-1', file, undefined);
      expect(Object.keys(result.rows[0].coin ?? {}).sort()).toEqual(
        ['country', 'denomination', 'id', 'mintMark', 'name', 'owned', 'variety', 'year'].sort(),
      );
    });
  });

  describe('preview: reads only (criteria #2, #4, #22)', () => {
    it('loads only approved coins, with a select, and the requesting user\'s ownership', async () => {
      const file = csvFile('Year,Country,Denomination\n1950,USA,Cent\n');
      await service.preview('user-42', file, undefined);

      expect(prisma.coin.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.coin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'approved' }, select: expect.any(Object) }),
      );
      expect(prisma.ownership.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.ownership.findMany).toHaveBeenCalledWith({ where: { userId: 'user-42' }, select: { coinId: true } });
    });

    it('scopes ownership to the userId it was called with', async () => {
      const file = csvFile('Year,Country,Denomination\n1950,USA,Cent\n');
      await service.preview('user-a', file, undefined);
      await service.preview('user-b', file, undefined);
      expect(prisma.ownership.findMany).toHaveBeenNthCalledWith(1, { where: { userId: 'user-a' }, select: { coinId: true } });
      expect(prisma.ownership.findMany).toHaveBeenNthCalledWith(2, { where: { userId: 'user-b' }, select: { coinId: true } });
    });

    it('calls no create/update/delete/upsert/$transaction/$executeRaw on success', async () => {
      const file = csvFile('Year,Country,Denomination\n1950,USA,Cent\n1909,USA,Cent\n');
      await service.preview('user-1', file, undefined);
      expectNoWritesExcept(prisma);
    });

    it('calls no write method when the file is rejected either', async () => {
      await service.preview('user-1', csvFile('Year,Country,Denomination\n'), undefined).catch(() => undefined);
      await service.preview('user-1', undefined, undefined).catch(() => undefined);
      expectNoWritesExcept(prisma);
    });
  });

  describe('confirm (criteria #3, #4, #5, #6)', () => {
    it('validates ids against approved coins, then writes only ownership.createMany with skipDuplicates', async () => {
      prisma.coin.findMany.mockResolvedValue([{ id: COIN_1909_S_VDB }, { id: COIN_1950_D }]);
      prisma.ownership.createMany.mockResolvedValue({ count: 2 });

      const result = await service.confirm('user-1', [COIN_1909_S_VDB, COIN_1950_D]);

      expect(prisma.coin.findMany).toHaveBeenCalledWith({
        where: { id: { in: [COIN_1909_S_VDB, COIN_1950_D] }, status: 'approved' },
        select: { id: true },
      });
      expect(prisma.ownership.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.ownership.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'user-1', coinId: COIN_1909_S_VDB },
          { userId: 'user-1', coinId: COIN_1950_D },
        ],
        skipDuplicates: true,
      });
      expect(result).toEqual({ requested: 2, created: 2, alreadyOwned: 0 });
      expectNoWritesExcept(prisma, [prisma.ownership.createMany]);
    });

    it('de-duplicates ids in first-seen order and reports requested as the unique count', async () => {
      prisma.coin.findMany.mockResolvedValue([{ id: COIN_1950_D }, { id: COIN_1909_S }]);
      prisma.ownership.createMany.mockResolvedValue({ count: 2 });

      const result = await service.confirm('user-9', [COIN_1950_D, COIN_1909_S, COIN_1950_D, COIN_1950_D]);

      expect(prisma.coin.findMany).toHaveBeenCalledWith({
        where: { id: { in: [COIN_1950_D, COIN_1909_S] }, status: 'approved' },
        select: { id: true },
      });
      expect(prisma.ownership.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'user-9', coinId: COIN_1950_D },
          { userId: 'user-9', coinId: COIN_1909_S },
        ],
        skipDuplicates: true,
      });
      expect(result).toEqual({ requested: 2, created: 2, alreadyOwned: 0 });
    });

    it('reports alreadyOwned as requested minus created', async () => {
      prisma.coin.findMany.mockResolvedValue([{ id: COIN_1909_S_VDB }, { id: COIN_1909_S }, { id: COIN_1950_D }]);
      prisma.ownership.createMany.mockResolvedValue({ count: 1 });
      const some = await service.confirm('user-1', [COIN_1909_S_VDB, COIN_1909_S, COIN_1950_D]);
      expect(some).toEqual({ requested: 3, created: 1, alreadyOwned: 2 });

      prisma.ownership.createMany.mockResolvedValue({ count: 0 });
      const none = await service.confirm('user-1', [COIN_1909_S_VDB, COIN_1909_S, COIN_1950_D]);
      expect(none).toEqual({ requested: 3, created: 0, alreadyOwned: 3 });
    });

    it('rejects with BadRequestException(IMPORT_UNKNOWN_COIN) and writes nothing when an id is not an approved coin', async () => {
      prisma.coin.findMany.mockResolvedValue([{ id: COIN_1909_S_VDB }]);

      const promise = service.confirm('user-1', [COIN_1909_S_VDB, COIN_1950_D]);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toMatchObject({ message: 'IMPORT_UNKNOWN_COIN' });
      expect(prisma.ownership.createMany).not.toHaveBeenCalled();
      expectNoWritesExcept(prisma);
    });

    it('compares against the unique count, so duplicates of one valid id do not trigger IMPORT_UNKNOWN_COIN', async () => {
      prisma.coin.findMany.mockResolvedValue([{ id: COIN_1950_D }]);
      prisma.ownership.createMany.mockResolvedValue({ count: 1 });
      const result = await service.confirm('user-1', [COIN_1950_D, COIN_1950_D]);
      expect(result).toEqual({ requested: 1, created: 1, alreadyOwned: 0 });
    });
  });
});
