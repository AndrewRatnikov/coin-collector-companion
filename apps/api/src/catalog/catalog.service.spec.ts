/**
 * Tests for: CatalogService
 * Contract source: runs/run_20260719_190933/plan.md § Interface Contract (Service: CatalogService)
 *                   runs/run_20260725_140648/plan.md § Interface Contract → Backend — CatalogService (MODIFY)
 * Covers criteria: #2, #3, #4, #5, #6, #7, #8, #9, #11 (from run_20260719_190933's prd.md),
 *                  #1, #2, #3, #4 (from run_20260725_140648's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (coin.findMany / coin.count / coin.findUnique /
 * coin.findFirst / coin.create) — no real DB or network call, per plan.md's "Prisma calls
 * the Tester's mock must cover exactly" list. FindCatalogQueryDto instances are built via
 * `new FindCatalogQueryDto()` + Object.assign so the class field defaults (page = 1, limit = 20)
 * documented in the Interface Contract are exercised the same way Nest's ValidationPipe would
 * produce them — no name/shape is invented beyond what plan.md's DTO field list already specifies.
 *
 * The P2002 backstop test constructs a real Prisma.PrismaClientKnownRequestError from
 * @prisma/client (same pattern already established in collection.service.spec.ts's
 * makeP2003Error) rather than a shape-alike plain object, so the
 * `err instanceof Prisma.PrismaClientKnownRequestError` check in the implementation is
 * exercised faithfully.
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { FindCatalogQueryDto } from './dto/find-catalog-query.dto';
import { CreateCoinDto } from './dto/create-coin.dto';
import { PrismaService } from '../prisma/prisma.service';

function makeQuery(overrides: Partial<FindCatalogQueryDto> = {}): FindCatalogQueryDto {
  return Object.assign(new FindCatalogQueryDto(), overrides);
}

function makeCreateDto(overrides: Partial<CreateCoinDto> = {}): CreateCoinDto {
  return Object.assign(new CreateCoinDto(), {
    country: 'USA',
    denomination: '1 Cent',
    name: 'Indian Head Cent',
    year: 1900,
    mintMark: '',
    variety: '',
    ...overrides,
  });
}

function makeP2002Error(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.3',
  });
}

const SUBMITTER_USER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('CatalogService', () => {
  let service: CatalogService;
  let mockPrismaService: {
    coin: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrismaService = {
      coin: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get(CatalogService);
  });

  describe('findAll — filter construction', () => {
    it('applies an exact-match country filter (criterion #2)', async () => {
      await service.findAll(makeQuery({ country: 'USA' }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.country).toBe('USA');
    });

    it('applies an exact-match denomination filter (criterion #3)', async () => {
      await service.findAll(makeQuery({ denomination: 'Cent' }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.denomination).toBe('Cent');
    });

    it('applies a case-insensitive substring match on name (criterion #4)', async () => {
      await service.findAll(makeQuery({ name: 'lincoln' }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.name).toEqual({ contains: 'lincoln', mode: 'insensitive' });
    });

    it('applies only yearMin when yearMax is absent (criterion #5)', async () => {
      await service.findAll(makeQuery({ yearMin: 1920 }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.year).toEqual({ gte: 1920 });
    });

    it('applies only yearMax when yearMin is absent (criterion #5)', async () => {
      await service.findAll(makeQuery({ yearMax: 1930 }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.year).toEqual({ lte: 1930 });
    });

    it('applies both yearMin and yearMax together, inclusive (criterion #5)', async () => {
      await service.findAll(makeQuery({ yearMin: 1920, yearMax: 1930 }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.year).toEqual({ gte: 1920, lte: 1930 });
    });

    it('omits the year filter entirely when neither yearMin nor yearMax is present', async () => {
      await service.findAll(makeQuery());

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.year).toBeUndefined();
    });

    it('omits country/denomination/name from where when not provided', async () => {
      await service.findAll(makeQuery());

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.country).toBeUndefined();
      expect(where.denomination).toBeUndefined();
      expect(where.name).toBeUndefined();
    });
  });

  describe('findAll — status filter (run_20260725_140648 criteria #2, #8)', () => {
    it('always filters to status: approved, with no filters given', async () => {
      await service.findAll(makeQuery());

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.status).toBe('approved');
    });

    it('still filters to status: approved even when other filters are combined', async () => {
      await service.findAll(makeQuery({ country: 'USA', yearMin: 1909, yearMax: 1958 }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.status).toBe('approved');
      expect(where.country).toBe('USA');
    });

    it('applies the same status filter to the count query as findMany', async () => {
      await service.findAll(makeQuery());

      const findManyWhere = mockPrismaService.coin.findMany.mock.calls[0][0].where;
      const countWhere = mockPrismaService.coin.count.mock.calls[0][0].where;
      expect(countWhere.status).toBe('approved');
      expect(countWhere).toEqual(findManyWhere);
    });

    it('is not derived from any query param — the DTO has no status field to toggle it off', () => {
      const query = makeQuery();
      expect((query as unknown as Record<string, unknown>).status).toBeUndefined();
    });
  });

  describe('findAll — pagination (criteria #6, #7, #8)', () => {
    it('defaults to page 1 / limit 20 when the DTO is unmodified', async () => {
      const result = await service.findAll(makeQuery());

      const call = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(call.skip).toBe(0);
      expect(call.take).toBe(20);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('computes skip from page and limit', async () => {
      await service.findAll(makeQuery({ page: 3, limit: 10 }));

      const call = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(10);
    });

    it('clamps a limit above 100 down to 100, not honored literally', async () => {
      const result = await service.findAll(makeQuery({ limit: 1000 }));

      const call = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(call.take).toBe(100);
      expect(result.limit).toBe(100);
    });

    it('returns total from the separate count query, not items.length', async () => {
      mockPrismaService.coin.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      mockPrismaService.coin.count.mockResolvedValue(50);

      const result = await service.findAll(makeQuery());

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(50);
    });

    it('returns the { items, page, limit, total } shape', async () => {
      mockPrismaService.coin.findMany.mockResolvedValue([{ id: 'x' }]);
      mockPrismaService.coin.count.mockResolvedValue(1);

      const result = await service.findAll(makeQuery({ page: 2, limit: 5 }));

      expect(result).toEqual({
        items: [{ id: 'x' }],
        page: 2,
        limit: 5,
        total: 1,
      });
    });

    it('passes the same where clause to both findMany and count', async () => {
      await service.findAll(makeQuery({ country: 'USA', yearMin: 1909 }));

      const findManyWhere = mockPrismaService.coin.findMany.mock.calls[0][0].where;
      const countWhere = mockPrismaService.coin.count.mock.calls[0][0].where;
      expect(findManyWhere).toEqual(countWhere);
    });
  });

  describe('findOne (criteria #9, #11 — untouched by this run, no status filter)', () => {
    it('returns the coin when Prisma finds a match', async () => {
      const coin = { id: '11111111-1111-1111-1111-111111111111', name: 'Lincoln Wheat Cent' };
      mockPrismaService.coin.findUnique.mockResolvedValue(coin);

      const result = await service.findOne(coin.id);

      expect(result).toBe(coin);
      expect(mockPrismaService.coin.findUnique).toHaveBeenCalledWith({
        where: { id: coin.id },
      });
    });

    it('throws NotFoundException when no coin matches', async () => {
      mockPrismaService.coin.findUnique.mockResolvedValue(null);

      await expect(service.findOne('22222222-2222-2222-2222-222222222222')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('finds a pending coin by id with no status restriction (criterion #8/#2 contrast)', async () => {
      const pendingCoin = { id: 'pending-1', status: 'pending' };
      mockPrismaService.coin.findUnique.mockResolvedValue(pendingCoin);

      const result = await service.findOne('pending-1');

      expect(result).toBe(pendingCoin);
      const call = mockPrismaService.coin.findUnique.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'pending-1' });
      expect(call.where.status).toBeUndefined();
    });
  });

  describe('create — dedup check (run_20260725_140648 criterion #4)', () => {
    it('queries findFirst with no status restriction (across approved/pending/rejected)', async () => {
      mockPrismaService.coin.create.mockResolvedValue({ id: 'new-1', status: 'pending' });

      await service.create(SUBMITTER_USER_ID, makeCreateDto());

      const { where } = mockPrismaService.coin.findFirst.mock.calls[0][0];
      expect(where.status).toBeUndefined();
    });

    it('matches country and denomination case-insensitively', async () => {
      mockPrismaService.coin.create.mockResolvedValue({ id: 'new-1', status: 'pending' });

      await service.create(SUBMITTER_USER_ID, makeCreateDto({ country: 'usa', denomination: 'cent' }));

      const { where } = mockPrismaService.coin.findFirst.mock.calls[0][0];
      expect(where.country).toEqual({ equals: 'usa', mode: 'insensitive' });
      expect(where.denomination).toEqual({ equals: 'cent', mode: 'insensitive' });
    });

    it('matches year, mintMark, and variety exactly (not case-insensitively)', async () => {
      mockPrismaService.coin.create.mockResolvedValue({ id: 'new-1', status: 'pending' });

      await service.create(SUBMITTER_USER_ID, makeCreateDto({ year: 1943, mintMark: 'D', variety: 'Steel' }));

      const { where } = mockPrismaService.coin.findFirst.mock.calls[0][0];
      expect(where.year).toBe(1943);
      expect(where.mintMark).toBe('D');
      expect(where.variety).toBe('Steel');
    });

    it('defaults mintMark/variety to empty string in the dedup check when omitted', async () => {
      mockPrismaService.coin.create.mockResolvedValue({ id: 'new-1', status: 'pending' });

      await service.create(SUBMITTER_USER_ID, makeCreateDto({ mintMark: undefined, variety: undefined }));

      const { where } = mockPrismaService.coin.findFirst.mock.calls[0][0];
      expect(where.mintMark).toBe('');
      expect(where.variety).toBe('');
    });

    it('throws ConflictException (409) when an existing coin matches — approved fixture', async () => {
      mockPrismaService.coin.findFirst.mockResolvedValue({ id: 'existing-approved', status: 'approved' });

      await expect(service.create(SUBMITTER_USER_ID, makeCreateDto())).rejects.toThrow(ConflictException);
      expect(mockPrismaService.coin.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException (409) when an existing coin matches — pending fixture', async () => {
      mockPrismaService.coin.findFirst.mockResolvedValue({ id: 'existing-pending', status: 'pending' });

      await expect(service.create(SUBMITTER_USER_ID, makeCreateDto())).rejects.toThrow(ConflictException);
      expect(mockPrismaService.coin.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException (409) when an existing coin matches — rejected fixture', async () => {
      mockPrismaService.coin.findFirst.mockResolvedValue({ id: 'existing-rejected', status: 'rejected' });

      await expect(service.create(SUBMITTER_USER_ID, makeCreateDto())).rejects.toThrow(ConflictException);
      expect(mockPrismaService.coin.create).not.toHaveBeenCalled();
    });
  });

  describe('create — happy path (run_20260725_140648 criterion #3)', () => {
    it('creates with status: pending, submittedByUserId, and submittedAt set', async () => {
      mockPrismaService.coin.create.mockResolvedValue({ id: 'new-1', status: 'pending' });

      await service.create(SUBMITTER_USER_ID, makeCreateDto());

      const { data } = mockPrismaService.coin.create.mock.calls[0][0];
      expect(data.status).toBe('pending');
      expect(data.submittedByUserId).toBe(SUBMITTER_USER_ID);
      expect(data.submittedAt).toBeInstanceOf(Date);
    });

    it('passes country/denomination/name/year through from the dto', async () => {
      mockPrismaService.coin.create.mockResolvedValue({ id: 'new-1', status: 'pending' });

      await service.create(
        SUBMITTER_USER_ID,
        makeCreateDto({ country: 'Canada', denomination: '5 Cents', name: 'Beaver Nickel', year: 1937 }),
      );

      const { data } = mockPrismaService.coin.create.mock.calls[0][0];
      expect(data.country).toBe('Canada');
      expect(data.denomination).toBe('5 Cents');
      expect(data.name).toBe('Beaver Nickel');
      expect(data.year).toBe(1937);
    });

    it('the select clause omits submittedByUserId (privacy — never returned to a client)', async () => {
      mockPrismaService.coin.create.mockResolvedValue({ id: 'new-1', status: 'pending' });

      await service.create(SUBMITTER_USER_ID, makeCreateDto());

      const { select } = mockPrismaService.coin.create.mock.calls[0][0];
      expect(select.submittedByUserId).toBeUndefined();
      expect(select.status).toBe(true);
      expect(select.submittedAt).toBe(true);
      expect(select.id).toBe(true);
    });

    it('the returned coin object itself has no submittedByUserId key (real assertion, not just relying on select)', async () => {
      mockPrismaService.coin.create.mockResolvedValue({
        id: 'new-1',
        country: 'USA',
        status: 'pending',
        submittedAt: new Date('2026-07-25T00:00:00.000Z'),
      });

      const result = await service.create(SUBMITTER_USER_ID, makeCreateDto());

      expect(result).not.toHaveProperty('submittedByUserId');
      expect(result.status).toBe('pending');
    });
  });

  describe('create — race-condition backstop (run_20260725_140648 criterion #4)', () => {
    it('maps a P2002 thrown by prisma.coin.create to ConflictException (409)', async () => {
      mockPrismaService.coin.create.mockRejectedValue(makeP2002Error());

      await expect(service.create(SUBMITTER_USER_ID, makeCreateDto())).rejects.toThrow(ConflictException);
    });

    it('re-throws a non-P2002 error unchanged (not swallowed as a 409)', async () => {
      const unrelatedError = new Error('connection reset');
      mockPrismaService.coin.create.mockRejectedValue(unrelatedError);

      await expect(service.create(SUBMITTER_USER_ID, makeCreateDto())).rejects.toThrow('connection reset');
    });
  });
});
