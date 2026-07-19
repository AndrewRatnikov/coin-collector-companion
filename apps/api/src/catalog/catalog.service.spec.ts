/**
 * Tests for: CatalogService
 * Contract source: runs/run_20260719_190933/plan.md § Interface Contract (Service: CatalogService)
 * Covers criteria: #2, #3, #4, #5, #6, #7, #8, #9, #11 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (coin.findMany / coin.count / coin.findUnique) — no real
 * DB or network call, per plan.md's "Prisma calls the Tester's mock must cover exactly" list.
 * FindCatalogQueryDto instances are built via `new FindCatalogQueryDto()` + Object.assign so
 * the class field defaults (page = 1, limit = 20) documented in the Interface Contract are
 * exercised the same way Nest's ValidationPipe would produce them — no name/shape is invented
 * beyond what plan.md's DTO field list already specifies.
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { FindCatalogQueryDto } from './dto/find-catalog-query.dto';
import { PrismaService } from '../prisma/prisma.service';

function makeQuery(overrides: Partial<FindCatalogQueryDto> = {}): FindCatalogQueryDto {
  return Object.assign(new FindCatalogQueryDto(), overrides);
}

describe('CatalogService', () => {
  let service: CatalogService;
  let mockPrismaService: {
    coin: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrismaService = {
      coin: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
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

  describe('findOne (criteria #9, #11)', () => {
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
  });
});
