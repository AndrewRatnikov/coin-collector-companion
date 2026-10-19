/**
 * Tests for: CatalogService
 * Contract source: runs/run_20260719_190933/plan.md § Interface Contract (Service: CatalogService)
 *                   runs/run_20260725_140648/plan.md § Interface Contract → Backend — CatalogService (MODIFY)
 *                   runs/run_20260731_132040/plan.md § Interface Contract → Service: CatalogService.findAll (MODIFY)
 *                   runs/run_20261001_224939/plan.md § Interface Contract → Service: CatalogService (MODIFY)
 *                   runs/run_20261011_105146/plan.md § Interface Contract → Service: CatalogService (MODIFY)
 *                   runs/run_20261019_221037/plan.md § Interface Contract → Service: CatalogService.findAll (API, MODIFY)
 * Covers criteria: #2, #3, #4, #5, #6, #7, #8, #9, #11 (from run_20260719_190933's prd.md),
 *                  #1, #2, #3, #4 (from run_20260725_140648's prd.md),
 *                  #1, #2, #3, #4, #5 (from run_20260731_132040's prd.md),
 *                  #13, #14 (from run_20261001_224939's prd.md),
 *                  #1, #2, #3, #4, #5 (from run_20261011_105146's prd.md),
 *                  #1, #2, #3, #4, #5 (from run_20261019_221037's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (coin.findMany / coin.count / coin.findUnique /
 * coin.findFirst / coin.create, plus ownership.findMany and userSetCoin.findMany) — no real DB or
 * network call, per plan.md's "Prisma calls the Tester's mock must cover exactly" list.
 * FindCatalogQueryDto instances are built via
 * `new FindCatalogQueryDto()` + Object.assign so the class field defaults (page = 1, limit = 20)
 * documented in the Interface Contract are exercised the same way Nest's ValidationPipe would
 * produce them — no name/shape is invented beyond what plan.md's DTO field list already specifies.
 *
 * The P2002 backstop test constructs a real Prisma.PrismaClientKnownRequestError from
 * @prisma/client (same pattern already established in collection.service.spec.ts's
 * makeP2003Error) rather than a shape-alike plain object, so the
 * `err instanceof Prisma.PrismaClientKnownRequestError` check in the implementation is
 * exercised faithfully.
 *
 * run_20260731_132040: findAll now takes a second `userId?: string` argument. All existing
 * call sites below (`service.findAll(makeQuery(...))`) are preserved verbatim — calling with
 * one argument still exercises the pre-existing anonymous/no-submittedByMe behavior, since
 * `userId` is optional and `query.submittedByMe` is undefined on every pre-existing fixture.
 *
 * run_20261001_224939: CATALOG_COIN_SELECT is now exported and SUBMITTED_COIN_SELECT is added.
 * Only the new describe block "findAll — rejectionReason visibility" and the two new imports are
 * added; every existing block is untouched.
 *
 * run_20261011_105146: new describe blocks for multi-value denomination, keyDateOnly, hideOwned,
 * sort, and findFacets (distinct countries/denominations, scoping, ordering). The facets mock
 * tells the two findMany calls apart by `args.distinct[0]` ('country' vs 'denomination').
 *
 * run_20261019_221037: a signed-in findAll adds `owned` / `inSetsCount` to each item through two
 * batched queries (ownership.findMany, userSetCoin.findMany). The mock gets those two models; the
 * one exact-items assertion of the submittedByMe response-shape test changes on purpose. New
 * describe block "findAll — viewer fields".
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CATALOG_COIN_SELECT, CatalogService, SUBMITTED_COIN_SELECT } from './catalog.service';
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
const OTHER_USER_ID = '4a1b2c3d-6717-4562-b3fc-2c963f66afa7';

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
    ownership: { findMany: jest.Mock };
    userSetCoin: { findMany: jest.Mock };
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
      ownership: { findMany: jest.fn().mockResolvedValue([]) },
      userSetCoin: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get(CatalogService);
  });

  describe('findAll — filter construction', () => {
    it('applies a case-insensitive country filter (criterion #2)', async () => {
      await service.findAll(makeQuery({ country: 'USA' }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.country).toEqual({ equals: 'USA', mode: 'insensitive' });
    });

    it('applies a case-insensitive denomination filter (criterion #3)', async () => {
      await service.findAll(makeQuery({ denomination: 'Cent' }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.denomination).toEqual({ equals: 'Cent', mode: 'insensitive' });
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
      expect(where.country).toEqual({ equals: 'USA', mode: 'insensitive' });
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

    it('the select clause includes physical specs, mintage, and key-date flag', async () => {
      await service.findAll(makeQuery());

      const { select } = mockPrismaService.coin.findMany.mock.calls[0][0];
      for (const field of ['diameterMm', 'weightG', 'thicknessMm', 'material', 'mintage', 'isKeyDate']) {
        expect(select[field]).toBe(true);
      }
    });

    it('the select clause omits submittedByUserId — GET /catalog is public and unauthenticated', async () => {
      await service.findAll(makeQuery());

      const { select } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(select.submittedByUserId).toBeUndefined();
    });
  });

  describe('findAll — submittedByMe (run_20260731_132040 criteria #1, #2, #3, #4, #5)', () => {
    it('replaces status with submittedByUserId when submittedByMe is true and a userId is given (criterion #1)', async () => {
      await service.findAll(makeQuery({ submittedByMe: true }), SUBMITTER_USER_ID);

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.submittedByUserId).toBe(SUBMITTER_USER_ID);
      expect(where.status).toBeUndefined();
    });

    it('falls back to status: approved when submittedByMe is true but no userId is given — anonymous caller (criterion #2)', async () => {
      await service.findAll(makeQuery({ submittedByMe: true }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.status).toBe('approved');
      expect(where.submittedByUserId).toBeUndefined();
    });

    it('behaves identically to submittedByMe unset when submittedByMe is false, even with a userId present (criterion #3)', async () => {
      await service.findAll(makeQuery({ submittedByMe: false }), SUBMITTER_USER_ID);

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.status).toBe('approved');
      expect(where.submittedByUserId).toBeUndefined();
    });

    it('behaves identically to submittedByMe=true+no-userId when submittedByMe is unset and userId is present — status stays approved unless submittedByMe is explicitly true (criterion #3)', async () => {
      await service.findAll(makeQuery(), SUBMITTER_USER_ID);

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.status).toBe('approved');
      expect(where.submittedByUserId).toBeUndefined();
    });

    it('still applies country/denomination/name/year filters on top of the submitter filter (criterion #4)', async () => {
      await service.findAll(
        makeQuery({ submittedByMe: true, country: 'USA', denomination: '1 Cent', yearMin: 1909, yearMax: 1958 }),
        SUBMITTER_USER_ID,
      );

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.submittedByUserId).toBe(SUBMITTER_USER_ID);
      expect(where.country).toEqual({ equals: 'USA', mode: 'insensitive' });
      expect(where.denomination).toEqual({ equals: '1 Cent', mode: 'insensitive' });
      expect(where.year).toEqual({ gte: 1909, lte: 1958 });
    });

    it('scopes strictly to the calling userId — a different caller only sees their own submitter filter, never another user\'s (criterion #1 contrast)', async () => {
      await service.findAll(makeQuery({ submittedByMe: true }), OTHER_USER_ID);

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.submittedByUserId).toBe(OTHER_USER_ID);
      expect(where.submittedByUserId).not.toBe(SUBMITTER_USER_ID);
    });

    it('applies the same submitter where clause to the count query as findMany (criterion #1)', async () => {
      await service.findAll(makeQuery({ submittedByMe: true }), SUBMITTER_USER_ID);

      const findManyWhere = mockPrismaService.coin.findMany.mock.calls[0][0].where;
      const countWhere = mockPrismaService.coin.count.mock.calls[0][0].where;
      expect(countWhere).toEqual(findManyWhere);
      expect(countWhere.submittedByUserId).toBe(SUBMITTER_USER_ID);
    });

    it('the select clause still omits submittedByUserId even in the submittedByMe branch (criterion #5)', async () => {
      await service.findAll(makeQuery({ submittedByMe: true }), SUBMITTER_USER_ID);

      const { select } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(select.submittedByUserId).toBeUndefined();
    });

    it('the response shape is unchanged in the submittedByMe branch — { items, page, limit, total } (criterion #5)', async () => {
      mockPrismaService.coin.findMany.mockResolvedValue([{ id: 'pending-1', status: 'pending' }]);
      mockPrismaService.coin.count.mockResolvedValue(1);

      const result = await service.findAll(makeQuery({ submittedByMe: true }), SUBMITTER_USER_ID);

      // run_20261019_221037: a signed-in caller now also gets owned / inSetsCount on each item.
      expect(result).toEqual({
        items: [{ id: 'pending-1', status: 'pending', owned: false, inSetsCount: 0 }],
        page: 1,
        limit: 20,
        total: 1,
      });
    });
  });

  describe('findAll — rejectionReason visibility (run_20261001_224939 criteria #13, #14)', () => {
    it('exports CATALOG_COIN_SELECT without submittedByUserId or rejectionReason', () => {
      expect(CATALOG_COIN_SELECT).not.toHaveProperty('submittedByUserId');
      expect(CATALOG_COIN_SELECT).not.toHaveProperty('rejectionReason');
      expect(CATALOG_COIN_SELECT.id).toBe(true);
    });

    it('exports SUBMITTED_COIN_SELECT as CATALOG_COIN_SELECT plus rejectionReason, still without submittedByUserId', () => {
      expect(SUBMITTED_COIN_SELECT).toEqual({ ...CATALOG_COIN_SELECT, rejectionReason: true });
      expect(SUBMITTED_COIN_SELECT).not.toHaveProperty('submittedByUserId');
    });

    it('selects rejectionReason when submittedByMe is true and a userId is given', async () => {
      await service.findAll(makeQuery({ submittedByMe: true }), SUBMITTER_USER_ID);

      const { select } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(select.rejectionReason).toBe(true);
      expect(select.submittedByUserId).toBeUndefined();
    });

    it('uses exactly SUBMITTED_COIN_SELECT on the submittedByMe branch', async () => {
      await service.findAll(makeQuery({ submittedByMe: true }), SUBMITTER_USER_ID);

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].select).toEqual(SUBMITTED_COIN_SELECT);
    });

    it('does not select rejectionReason on the public (anonymous, no submittedByMe) read', async () => {
      await service.findAll(makeQuery());

      const { select } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(select.rejectionReason).toBeUndefined();
      expect(select).toEqual(CATALOG_COIN_SELECT);
    });

    it('does not select rejectionReason when submittedByMe is true but there is no userId (anonymous caller)', async () => {
      await service.findAll(makeQuery({ submittedByMe: true }));

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].select.rejectionReason).toBeUndefined();
    });

    it('does not select rejectionReason when submittedByMe is false, even with a userId present', async () => {
      await service.findAll(makeQuery({ submittedByMe: false }), SUBMITTER_USER_ID);

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].select.rejectionReason).toBeUndefined();
    });

    it('does not select rejectionReason when a userId is present but submittedByMe is unset', async () => {
      await service.findAll(makeQuery(), SUBMITTER_USER_ID);

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].select.rejectionReason).toBeUndefined();
    });

    it('findOne (public GET /catalog/:id) never selects rejectionReason', async () => {
      mockPrismaService.coin.findUnique.mockResolvedValue({ id: 'x' });

      await service.findOne('x');

      const { select } = mockPrismaService.coin.findUnique.mock.calls[0][0];
      expect(select.rejectionReason).toBeUndefined();
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

  describe('findAll — multi-value denomination (run_20261011_105146 criterion #1)', () => {
    it('two or more values become a case-insensitive OR in input order, with no where.denomination key', async () => {
      await service.findAll(makeQuery({ denomination: ['5 Kopiyok', '10 Hryvnias'] }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.OR).toEqual([
        { denomination: { equals: '5 Kopiyok', mode: 'insensitive' } },
        { denomination: { equals: '10 Hryvnias', mode: 'insensitive' } },
      ]);
      expect(where.denomination).toBeUndefined();
    });

    it('a different pair of values yields a different OR (not hard-coded)', async () => {
      await service.findAll(makeQuery({ denomination: ['1 Cent', '5 Cents', '10 Cents'] }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.OR).toHaveLength(3);
      expect(where.OR[2]).toEqual({ denomination: { equals: '10 Cents', mode: 'insensitive' } });
    });

    it('a one-element array behaves like the single string: where.denomination and no where.OR', async () => {
      await service.findAll(makeQuery({ denomination: ['Cent'] }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.denomination).toEqual({ equals: 'Cent', mode: 'insensitive' });
      expect(where.OR).toBeUndefined();
    });

    it('a single plain string produces no where.OR', async () => {
      await service.findAll(makeQuery({ denomination: 'Cent' }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.OR).toBeUndefined();
    });

    it('trims entries and drops blank ones before deciding single versus OR', async () => {
      await service.findAll(makeQuery({ denomination: ['  Cent  ', '   ', ''] }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.denomination).toEqual({ equals: 'Cent', mode: 'insensitive' });
      expect(where.OR).toBeUndefined();
    });

    it('an array of only blank entries adds no denomination clause at all', async () => {
      await service.findAll(makeQuery({ denomination: ['', '  '] }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.denomination).toBeUndefined();
      expect(where.OR).toBeUndefined();
    });

    it('passes the same OR where clause to the count query', async () => {
      await service.findAll(makeQuery({ denomination: ['5 Kopiyok', '10 Hryvnias'] }));

      const findManyWhere = mockPrismaService.coin.findMany.mock.calls[0][0].where;
      const countWhere = mockPrismaService.coin.count.mock.calls[0][0].where;
      expect(countWhere).toEqual(findManyWhere);
      expect(countWhere.OR).toHaveLength(2);
    });

    it('still applies status approved alongside the OR', async () => {
      await service.findAll(makeQuery({ denomination: ['5 Kopiyok', '10 Hryvnias'], country: 'Ukraine' }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.status).toBe('approved');
      expect(where.country).toEqual({ equals: 'Ukraine', mode: 'insensitive' });
    });
  });

  describe('findAll — keyDateOnly (run_20261011_105146 criterion #2)', () => {
    it('adds isKeyDate: true when keyDateOnly is true', async () => {
      await service.findAll(makeQuery({ keyDateOnly: true }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.isKeyDate).toBe(true);
    });

    it('omits isKeyDate when keyDateOnly is false', async () => {
      await service.findAll(makeQuery({ keyDateOnly: false }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.isKeyDate).toBeUndefined();
    });

    it('omits isKeyDate when keyDateOnly is unset', async () => {
      await service.findAll(makeQuery());

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.isKeyDate).toBeUndefined();
    });

    it('applies isKeyDate to the count query too', async () => {
      await service.findAll(makeQuery({ keyDateOnly: true }));

      const countWhere = mockPrismaService.coin.count.mock.calls[0][0].where;
      expect(countWhere.isKeyDate).toBe(true);
    });
  });

  describe('findAll — hideOwned (run_20261011_105146 criterion #3)', () => {
    it('adds ownerships: { none: { userId } } when hideOwned is true and a userId is given', async () => {
      await service.findAll(makeQuery({ hideOwned: true }), SUBMITTER_USER_ID);

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.ownerships).toEqual({ none: { userId: SUBMITTER_USER_ID } });
    });

    it('uses the calling user id, not a constant', async () => {
      await service.findAll(makeQuery({ hideOwned: true }), OTHER_USER_ID);

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.ownerships).toEqual({ none: { userId: OTHER_USER_ID } });
    });

    it('is silently ignored for an anonymous caller (no userId)', async () => {
      await service.findAll(makeQuery({ hideOwned: true }));

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.ownerships).toBeUndefined();
      expect(where.status).toBe('approved');
    });

    it('is not applied when hideOwned is false, even with a userId', async () => {
      await service.findAll(makeQuery({ hideOwned: false }), SUBMITTER_USER_ID);

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.ownerships).toBeUndefined();
    });

    it('is not applied when hideOwned is unset, even with a userId', async () => {
      await service.findAll(makeQuery(), SUBMITTER_USER_ID);

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.ownerships).toBeUndefined();
    });

    it('combines with submittedByMe when both are set', async () => {
      await service.findAll(makeQuery({ hideOwned: true, submittedByMe: true }), SUBMITTER_USER_ID);

      const { where } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(where.submittedByUserId).toBe(SUBMITTER_USER_ID);
      expect(where.ownerships).toEqual({ none: { userId: SUBMITTER_USER_ID } });
    });

    it('applies the same ownerships clause to the count query', async () => {
      await service.findAll(makeQuery({ hideOwned: true }), SUBMITTER_USER_ID);

      const findManyWhere = mockPrismaService.coin.findMany.mock.calls[0][0].where;
      const countWhere = mockPrismaService.coin.count.mock.calls[0][0].where;
      expect(countWhere).toEqual(findManyWhere);
    });
  });

  describe('findAll — sort (run_20261011_105146 criterion #4)', () => {
    it('year_asc orders by year then id ascending', async () => {
      await service.findAll(makeQuery({ sort: 'year_asc' }));

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].orderBy).toEqual([{ year: 'asc' }, { id: 'asc' }]);
    });

    it('year_desc orders by year descending then id ascending', async () => {
      await service.findAll(makeQuery({ sort: 'year_desc' }));

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].orderBy).toEqual([{ year: 'desc' }, { id: 'asc' }]);
    });

    it('name_asc orders by name, then year, then id ascending', async () => {
      await service.findAll(makeQuery({ sort: 'name_asc' }));

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].orderBy).toEqual([
        { name: 'asc' },
        { year: 'asc' },
        { id: 'asc' },
      ]);
    });

    it('defaults to year_asc when the DTO is unmodified', async () => {
      await service.findAll(makeQuery());

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].orderBy).toEqual([{ year: 'asc' }, { id: 'asc' }]);
    });

    it('falls back to year_asc when sort is explicitly undefined', async () => {
      await service.findAll(makeQuery({ sort: undefined }));

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].orderBy).toEqual([{ year: 'asc' }, { id: 'asc' }]);
    });

    it('still uses exactly CATALOG_COIN_SELECT on the public read', async () => {
      await service.findAll(makeQuery({ sort: 'name_asc', keyDateOnly: true, denomination: ['a', 'b'] }));

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].select).toEqual(CATALOG_COIN_SELECT);
    });
  });

  describe('findAll — viewer fields (run_20261019_221037 criteria #1, #2, #3, #4, #5)', () => {
    const PAGE = [{ id: 'coin-a' }, { id: 'coin-b' }, { id: 'coin-c' }];

    function stubPage(items: Array<{ id: string }> = PAGE, total = items.length) {
      mockPrismaService.coin.findMany.mockResolvedValue(items);
      mockPrismaService.coin.count.mockResolvedValue(total);
    }

    it('adds owned and inSetsCount to every item for a signed-in caller, matched per coin (criterion #1)', async () => {
      stubPage();
      mockPrismaService.ownership.findMany.mockResolvedValue([{ coinId: 'coin-b' }]);
      mockPrismaService.userSetCoin.findMany.mockResolvedValue([{ coinId: 'coin-a' }, { coinId: 'coin-c' }]);

      const result = await service.findAll(makeQuery(), SUBMITTER_USER_ID);

      expect(result.items).toEqual([
        { id: 'coin-a', owned: false, inSetsCount: 1 },
        { id: 'coin-b', owned: true, inSetsCount: 0 },
        { id: 'coin-c', owned: false, inSetsCount: 1 },
      ]);
    });

    it('a different ownership/membership result gives different fields (not hard-coded)', async () => {
      stubPage();
      mockPrismaService.ownership.findMany.mockResolvedValue([{ coinId: 'coin-a' }, { coinId: 'coin-c' }]);
      mockPrismaService.userSetCoin.findMany.mockResolvedValue([]);

      const result = await service.findAll(makeQuery(), SUBMITTER_USER_ID);

      expect(result.items).toEqual([
        { id: 'coin-a', owned: true, inSetsCount: 0 },
        { id: 'coin-b', owned: false, inSetsCount: 0 },
        { id: 'coin-c', owned: true, inSetsCount: 0 },
      ]);
    });

    it('inSetsCount is the number of membership rows for the coin, one per set (criterion #3)', async () => {
      stubPage([{ id: 'coin-a' }, { id: 'coin-b' }]);
      mockPrismaService.userSetCoin.findMany.mockResolvedValue([
        { coinId: 'coin-a' },
        { coinId: 'coin-a' },
        { coinId: 'coin-a' },
        { coinId: 'coin-b' },
      ]);

      const result = await service.findAll(makeQuery(), SUBMITTER_USER_ID);

      expect(result.items).toEqual([
        { id: 'coin-a', owned: false, inSetsCount: 3 },
        { id: 'coin-b', owned: false, inSetsCount: 1 },
      ]);
    });

    it('keeps the item order, page, limit and total (criterion #5)', async () => {
      stubPage([{ id: 'coin-z' }, { id: 'coin-a' }], 57);

      const result = await service.findAll(makeQuery({ page: 3, limit: 2 }), SUBMITTER_USER_ID);

      expect((result.items as Array<{ id: string }>).map((item) => item.id)).toEqual(['coin-z', 'coin-a']);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(2);
      expect(result.total).toBe(57);
    });

    it('keeps the original coin fields on each enriched item', async () => {
      stubPage([{ id: 'coin-a' }]);
      mockPrismaService.coin.findMany.mockResolvedValue([{ id: 'coin-a', name: 'Lincoln Wheat Cent', year: 1909 }]);

      const result = await service.findAll(makeQuery(), SUBMITTER_USER_ID);

      expect(result.items[0]).toMatchObject({ id: 'coin-a', name: 'Lincoln Wheat Cent', year: 1909 });
    });

    it('queries ownership with the exact args: caller, page coin ids in page order, select coinId only (criteria #1, #4)', async () => {
      stubPage();

      await service.findAll(makeQuery(), SUBMITTER_USER_ID);

      expect(mockPrismaService.ownership.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.ownership.findMany).toHaveBeenCalledWith({
        where: { userId: SUBMITTER_USER_ID, coinId: { in: ['coin-a', 'coin-b', 'coin-c'] } },
        select: { coinId: true },
      });
    });

    it('queries userSetCoin scoped to the caller\'s own user sets only (criterion #3)', async () => {
      stubPage();

      await service.findAll(makeQuery(), SUBMITTER_USER_ID);

      expect(mockPrismaService.userSetCoin.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.userSetCoin.findMany).toHaveBeenCalledWith({
        where: { coinId: { in: ['coin-a', 'coin-b', 'coin-c'] }, userSet: { userId: SUBMITTER_USER_ID } },
        select: { coinId: true },
      });
    });

    it('uses the calling user id in both queries, not a constant', async () => {
      stubPage([{ id: 'coin-q' }]);

      await service.findAll(makeQuery(), OTHER_USER_ID);

      expect(mockPrismaService.ownership.findMany.mock.calls[0][0].where).toEqual({
        userId: OTHER_USER_ID,
        coinId: { in: ['coin-q'] },
      });
      expect(mockPrismaService.userSetCoin.findMany.mock.calls[0][0].where).toEqual({
        coinId: { in: ['coin-q'] },
        userSet: { userId: OTHER_USER_ID },
      });
    });

    it('uses a fixed number of queries whatever the page size (criterion #4)', async () => {
      stubPage([{ id: 'coin-a' }]);
      await service.findAll(makeQuery(), SUBMITTER_USER_ID);
      const small = {
        coin: mockPrismaService.coin.findMany.mock.calls.length,
        count: mockPrismaService.coin.count.mock.calls.length,
        ownership: mockPrismaService.ownership.findMany.mock.calls.length,
        sets: mockPrismaService.userSetCoin.findMany.mock.calls.length,
      };

      mockPrismaService.coin.findMany.mockClear();
      mockPrismaService.coin.count.mockClear();
      mockPrismaService.ownership.findMany.mockClear();
      mockPrismaService.userSetCoin.findMany.mockClear();
      const many = Array.from({ length: 50 }, (_, i) => ({ id: `coin-${i}` }));
      stubPage(many);
      await service.findAll(makeQuery({ limit: 50 }), SUBMITTER_USER_ID);

      expect({
        coin: mockPrismaService.coin.findMany.mock.calls.length,
        count: mockPrismaService.coin.count.mock.calls.length,
        ownership: mockPrismaService.ownership.findMany.mock.calls.length,
        sets: mockPrismaService.userSetCoin.findMany.mock.calls.length,
      }).toEqual(small);
      expect(small).toEqual({ coin: 1, count: 1, ownership: 1, sets: 1 });
      expect(mockPrismaService.ownership.findMany.mock.calls[0][0].where.coinId.in).toHaveLength(50);
    });

    it('makes no enrichment query for an empty page and returns it unchanged (edge case)', async () => {
      stubPage([], 0);

      const result = await service.findAll(makeQuery(), SUBMITTER_USER_ID);

      expect(mockPrismaService.ownership.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.userSetCoin.findMany).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [], page: 1, limit: 20, total: 0 });
    });

    it('anonymous caller: no enrichment queries and the items are passed through untouched (criterion #2)', async () => {
      const rows = [{ id: 'coin-a' }, { id: 'coin-b' }];
      stubPage(rows);

      const result = await service.findAll(makeQuery());

      expect(mockPrismaService.ownership.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.userSetCoin.findMany).not.toHaveBeenCalled();
      for (const item of result.items) {
        expect(item).not.toHaveProperty('owned');
        expect(item).not.toHaveProperty('inSetsCount');
      }
      expect(result.items).toEqual(rows);
    });

    it('a falsy (empty-string) userId is treated as anonymous', async () => {
      stubPage();

      const result = await service.findAll(makeQuery(), '');

      expect(mockPrismaService.ownership.findMany).not.toHaveBeenCalled();
      expect(result.items[0]).not.toHaveProperty('owned');
    });

    it('does not change the coin query or the count query for a signed-in caller (criteria #4, #5)', async () => {
      stubPage();
      await service.findAll(makeQuery({ country: 'USA', yearMin: 1909 }), SUBMITTER_USER_ID);
      const signedIn = {
        findMany: mockPrismaService.coin.findMany.mock.calls[0][0],
        count: mockPrismaService.coin.count.mock.calls[0][0],
      };

      mockPrismaService.coin.findMany.mockClear();
      mockPrismaService.coin.count.mockClear();
      await service.findAll(makeQuery({ country: 'USA', yearMin: 1909 }));

      expect(signedIn.findMany).toEqual(mockPrismaService.coin.findMany.mock.calls[0][0]);
      expect(signedIn.count).toEqual(mockPrismaService.coin.count.mock.calls[0][0]);
      expect(signedIn.findMany.select).toEqual(CATALOG_COIN_SELECT);
    });

    it('hideOwned: the ownership where on the coin query is kept and items are still enriched (criterion #5)', async () => {
      stubPage([{ id: 'coin-a' }]);
      mockPrismaService.userSetCoin.findMany.mockResolvedValue([{ coinId: 'coin-a' }, { coinId: 'coin-a' }]);

      const result = await service.findAll(makeQuery({ hideOwned: true }), SUBMITTER_USER_ID);

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].where.ownerships).toEqual({
        none: { userId: SUBMITTER_USER_ID },
      });
      expect(result.items).toEqual([{ id: 'coin-a', owned: false, inSetsCount: 2 }]);
    });

    it('submittedByMe: enriches the items and still selects exactly SUBMITTED_COIN_SELECT (criterion #5)', async () => {
      stubPage([{ id: 'pending-1' }]);
      mockPrismaService.ownership.findMany.mockResolvedValue([{ coinId: 'pending-1' }]);

      const result = await service.findAll(makeQuery({ submittedByMe: true }), SUBMITTER_USER_ID);

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].select).toEqual(SUBMITTED_COIN_SELECT);
      expect(result.items).toEqual([{ id: 'pending-1', owned: true, inSetsCount: 0 }]);
    });
  });

  describe('findFacets (run_20261011_105146 criterion #5)', () => {
    function mockFacetRows(countries: string[], denominations: string[]) {
      mockPrismaService.coin.findMany.mockImplementation((args: { distinct: string[] }) => {
        if (args.distinct[0] === 'country') {
          return Promise.resolve(countries.map((country) => ({ country })));
        }
        return Promise.resolve(denominations.map((denomination) => ({ denomination })));
      });
    }

    function callFor(distinct: 'country' | 'denomination') {
      const call = mockPrismaService.coin.findMany.mock.calls.find(
        (args: unknown[]) => (args[0] as { distinct: string[] }).distinct[0] === distinct,
      );
      return call?.[0];
    }

    it('makes exactly two findMany calls, with the exact args, when no country is given', async () => {
      mockFacetRows([], []);

      await service.findFacets();

      expect(mockPrismaService.coin.findMany).toHaveBeenCalledTimes(2);
      expect(callFor('country')).toEqual({
        where: { status: 'approved' },
        distinct: ['country'],
        select: { country: true },
      });
      expect(callFor('denomination')).toEqual({
        where: { status: 'approved' },
        distinct: ['denomination'],
        select: { denomination: true },
      });
    });

    it('scopes only the denomination query to the given country, case-insensitively', async () => {
      mockFacetRows([], []);

      await service.findFacets('Ukraine');

      expect(callFor('denomination').where).toEqual({
        status: 'approved',
        country: { equals: 'Ukraine', mode: 'insensitive' },
      });
      expect(callFor('country').where).toEqual({ status: 'approved' });
    });

    it('treats a blank or whitespace-only country as absent', async () => {
      mockFacetRows([], []);

      await service.findFacets('   ');

      expect(callFor('denomination').where).toEqual({ status: 'approved' });
    });

    it('treats an empty-string country as absent', async () => {
      mockFacetRows([], []);

      await service.findFacets('');

      expect(callFor('denomination').where).toEqual({ status: 'approved' });
    });

    it('returns countries sorted A-Z', async () => {
      mockFacetRows(['Ukraine', 'Canada', 'USA'], []);

      const result = await service.findFacets();

      expect(result.countries).toEqual(['Canada', 'Ukraine', 'USA']);
    });

    it('sorts a different country set differently (not hard-coded)', async () => {
      mockFacetRows(['Zimbabwe', 'Albania'], []);

      const result = await service.findFacets();

      expect(result.countries).toEqual(['Albania', 'Zimbabwe']);
    });

    it('sorts denominations by numeral numerically, then by name', async () => {
      mockFacetRows([], ['50 Kopiyok', '10 Hryvnias', 'Cent', '1 Hryvnia', '10 Kopiyok']);

      const result = await service.findFacets();

      expect(result.denominations).toEqual(['1 Hryvnia', 'Cent', '10 Hryvnias', '10 Kopiyok', '50 Kopiyok']);
    });

    it('reads a comma as a decimal point when ordering numerals', async () => {
      mockFacetRows([], ['10 Kopiyok', '2,5 Kopiyok', '2 Kopiyok']);

      const result = await service.findFacets();

      expect(result.denominations).toEqual(['2 Kopiyok', '2,5 Kopiyok', '10 Kopiyok']);
    });

    it('returns empty lists when the catalog has no approved coins', async () => {
      mockFacetRows([], []);

      await expect(service.findFacets()).resolves.toEqual({ countries: [], denominations: [] });
    });

    it('never calls count/findFirst/findUnique', async () => {
      mockFacetRows(['USA'], ['1 Cent']);

      await service.findFacets();

      expect(mockPrismaService.coin.count).not.toHaveBeenCalled();
      expect(mockPrismaService.coin.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.coin.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findOne (criteria #9, #11 — untouched by this run, no status filter)', () => {
    it('returns the coin when Prisma finds a match', async () => {
      const coin = { id: '11111111-1111-1111-1111-111111111111', name: 'Lincoln Wheat Cent' };
      mockPrismaService.coin.findUnique.mockResolvedValue(coin);

      const result = await service.findOne(coin.id);

      expect(result).toBe(coin);
      const call = mockPrismaService.coin.findUnique.mock.calls[0][0];
      expect(call.where).toEqual({ id: coin.id });
    });

    it('the select clause omits submittedByUserId — GET /catalog/:id is public and unauthenticated', async () => {
      mockPrismaService.coin.findUnique.mockResolvedValue({ id: 'x' });

      await service.findOne('x');

      const { select } = mockPrismaService.coin.findUnique.mock.calls[0][0];
      expect(select.submittedByUserId).toBeUndefined();
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
