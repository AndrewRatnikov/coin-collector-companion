/**
 * Tests for: AdminService (findCoins, reviewCoin)
 * Contract source: runs/run_20261001_224939/plan.md § Interface Contract → Service: AdminService (CREATE)
 * Covers criteria: #6, #7, #8, #9, #10, #13, #14, #17 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (coin.findMany / coin.count / coin.findUnique / coin.update),
 * the exact set listed in the contract's "Prisma calls used (for mocks)". DTO instances are built
 * with `new Dto()` + Object.assign so the class field defaults from the contract apply.
 * P2002 / P2025 errors are real Prisma.PrismaClientKnownRequestError instances (same pattern as
 * catalog.service.spec.ts) so an `instanceof` check in the implementation is exercised faithfully.
 */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';
import { FindAdminCoinsQueryDto } from './dto/find-admin-coins-query.dto';
import { ReviewCoinDto } from './dto/review-coin.dto';

function makeQuery(overrides: Partial<FindAdminCoinsQueryDto> = {}): FindAdminCoinsQueryDto {
  return Object.assign(new FindAdminCoinsQueryDto(), overrides);
}

function makeReviewDto(overrides: Partial<ReviewCoinDto> = {}): ReviewCoinDto {
  return Object.assign(new ReviewCoinDto(), { status: 'approved' as const, ...overrides });
}

function makeKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('prisma error', { code, clientVersion: '6.19.3' });
}

const COIN_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pending-1',
    country: 'USA',
    denomination: '1 Cent',
    name: 'Lincoln Wheat Cent',
    year: 1943,
    mintMark: 'D',
    variety: 'Steel',
    status: 'pending',
    rejectionReason: null,
    submitter: { email: 'submitter@example.com' },
    ...overrides,
  };
}

function makeApproved(overrides: Record<string, unknown> = {}) {
  return {
    id: 'approved-1',
    name: 'Lincoln Wheat Cent (approved)',
    country: 'USA',
    denomination: '1 Cent',
    year: 1943,
    mintMark: 'D',
    variety: 'Steel',
    ...overrides,
  };
}

describe('AdminService', () => {
  let service: AdminService;
  let mockPrismaService: {
    coin: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrismaService = {
      coin: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get(AdminService);
  });

  describe('findCoins — query construction (criterion #6)', () => {
    it('filters by the requested status, newest first with a deterministic tiebreak', async () => {
      await service.findCoins(makeQuery({ status: 'pending' }));

      const call = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ status: 'pending' });
      expect(call.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
    });

    it('honours a different status (rejected), not a hard-coded pending', async () => {
      await service.findCoins(makeQuery({ status: 'rejected' }));

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].where).toEqual({ status: 'rejected' });
    });

    it('defaults to status pending, page 1, limit 20 when the DTO is unmodified', async () => {
      const result = await service.findCoins(makeQuery());

      const call = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('pending');
      expect(call.skip).toBe(0);
      expect(call.take).toBe(20);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('computes skip from page and limit', async () => {
      await service.findCoins(makeQuery({ page: 3, limit: 10 }));

      const call = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(10);
    });

    it('clamps a limit above 100 down to 100', async () => {
      const result = await service.findCoins(makeQuery({ limit: 1000 }));

      expect(mockPrismaService.coin.findMany.mock.calls[0][0].take).toBe(100);
      expect(result.limit).toBe(100);
    });

    it('returns total from the count query using the same where as the list query', async () => {
      mockPrismaService.coin.findMany.mockResolvedValueOnce([makeRow()]);
      mockPrismaService.coin.count.mockResolvedValue(42);

      const result = await service.findCoins(makeQuery({ status: 'pending' }));

      expect(result.total).toBe(42);
      expect(result.items).toHaveLength(1);
      expect(mockPrismaService.coin.count.mock.calls[0][0].where).toEqual(
        mockPrismaService.coin.findMany.mock.calls[0][0].where,
      );
    });

    it('selects the submitter email and rejectionReason, and never submittedByUserId (criterion #14)', async () => {
      await service.findCoins(makeQuery());

      const { select } = mockPrismaService.coin.findMany.mock.calls[0][0];
      expect(select.submitter).toEqual({ select: { email: true } });
      expect(select.rejectionReason).toBe(true);
      expect(select.submittedByUserId).toBeUndefined();
      expect(select.id).toBe(true);
      expect(select.status).toBe(true);
    });
  });

  describe('findCoins — result mapping (criterion #6)', () => {
    it('maps submitter.email to submitterEmail and drops the submitter key', async () => {
      mockPrismaService.coin.findMany.mockResolvedValueOnce([makeRow()]).mockResolvedValueOnce([]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].submitterEmail).toBe('submitter@example.com');
      expect(result.items[0]).not.toHaveProperty('submitter');
      expect(result.items[0]).not.toHaveProperty('submittedByUserId');
    });

    it('maps a missing submitter (deleted account) to submitterEmail null', async () => {
      mockPrismaService.coin.findMany.mockResolvedValueOnce([makeRow({ submitter: null })]).mockResolvedValueOnce([]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].submitterEmail).toBeNull();
    });

    it('keeps each row\'s own submitter email (no cross-row mix-up)', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([
          makeRow({ id: 'p1', year: 1900, submitter: { email: 'one@example.com' } }),
          makeRow({ id: 'p2', year: 1901, submitter: { email: 'two@example.com' } }),
        ])
        .mockResolvedValueOnce([]);

      const result = await service.findCoins(makeQuery());

      expect(result.items.map((i) => [i.id, i.submitterEmail])).toEqual([
        ['p1', 'one@example.com'],
        ['p2', 'two@example.com'],
      ]);
    });

    it('returns the { items, page, limit, total } shape', async () => {
      mockPrismaService.coin.findMany.mockResolvedValueOnce([makeRow()]).mockResolvedValueOnce([]);
      mockPrismaService.coin.count.mockResolvedValue(1);

      const result = await service.findCoins(makeQuery({ page: 2, limit: 5 }));

      expect(result).toEqual({
        items: [expect.objectContaining({ id: 'pending-1' })],
        page: 2,
        limit: 5,
        total: 1,
      });
    });
  });

  describe('findCoins — possibleDuplicate (criterion #7)', () => {
    it('makes no duplicates query when the list is empty (findMany called once)', async () => {
      mockPrismaService.coin.findMany.mockResolvedValueOnce([]);

      const result = await service.findCoins(makeQuery());

      expect(result.items).toEqual([]);
      expect(mockPrismaService.coin.findMany).toHaveBeenCalledTimes(1);
    });

    it('issues exactly ONE duplicates query for several items, against approved coins excluding the items themselves', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([makeRow({ id: 'p1' }), makeRow({ id: 'p2', year: 1950 }), makeRow({ id: 'p3', year: 1960 })])
        .mockResolvedValueOnce([]);

      await service.findCoins(makeQuery());

      expect(mockPrismaService.coin.findMany).toHaveBeenCalledTimes(2);
      const dupCall = mockPrismaService.coin.findMany.mock.calls[1][0];
      expect(dupCall.where.status).toBe('approved');
      expect(dupCall.where.id).toEqual({ notIn: ['p1', 'p2', 'p3'] });
      expect(dupCall.where.OR).toHaveLength(3);
      expect(dupCall.orderBy).toEqual({ createdAt: 'asc' });
    });

    it('builds one OR clause per item: country/denomination case-insensitive, year/mintMark/variety exact', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([makeRow({ country: 'usa', denomination: '1 cent', year: 1943, mintMark: 'D', variety: 'Steel' })])
        .mockResolvedValueOnce([]);

      await service.findCoins(makeQuery());

      const dupCall = mockPrismaService.coin.findMany.mock.calls[1][0];
      expect(dupCall.where.OR[0]).toEqual(
        expect.objectContaining({
          country: { equals: 'usa', mode: 'insensitive' },
          denomination: { equals: '1 cent', mode: 'insensitive' },
          year: 1943,
          mintMark: 'D',
          variety: 'Steel',
        }),
      );
    });

    it('sets possibleDuplicate to { id, name } of the matching approved coin', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([makeRow()])
        .mockResolvedValueOnce([makeApproved({ id: 'approved-9', name: 'The Approved One' })]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].possibleDuplicate).toEqual({ id: 'approved-9', name: 'The Approved One' });
    });

    it('sets possibleDuplicate to null when no approved coin is returned', async () => {
      mockPrismaService.coin.findMany.mockResolvedValueOnce([makeRow()]).mockResolvedValueOnce([]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].possibleDuplicate).toBeNull();
    });

    it('matches country and denomination case-insensitively ("usa" pending vs "USA" approved)', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([makeRow({ country: 'usa', denomination: '1 CENT' })])
        .mockResolvedValueOnce([makeApproved({ country: 'USA', denomination: '1 Cent' })]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].possibleDuplicate).toEqual({ id: 'approved-1', name: 'Lincoln Wheat Cent (approved)' });
    });

    it('does not match an approved coin with a different year', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([makeRow({ year: 1943 })])
        .mockResolvedValueOnce([makeApproved({ year: 1944 })]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].possibleDuplicate).toBeNull();
    });

    it('does not match an approved coin with a different mintMark', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([makeRow({ mintMark: 'D' })])
        .mockResolvedValueOnce([makeApproved({ mintMark: 'S' })]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].possibleDuplicate).toBeNull();
    });

    it('does not match an approved coin with a different variety (strict, not case-insensitive)', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([makeRow({ variety: 'Steel' })])
        .mockResolvedValueOnce([makeApproved({ variety: 'steel' })]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].possibleDuplicate).toBeNull();
    });

    it('does not match an approved coin with a different country', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([makeRow({ country: 'USA' })])
        .mockResolvedValueOnce([makeApproved({ country: 'Canada' })]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].possibleDuplicate).toBeNull();
    });

    it('resolves each item independently: one with a duplicate and one without', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([makeRow({ id: 'p1', year: 1943 }), makeRow({ id: 'p2', year: 1955 })])
        .mockResolvedValueOnce([makeApproved({ id: 'approved-1943', year: 1943 })]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].possibleDuplicate).toEqual({
        id: 'approved-1943',
        name: 'Lincoln Wheat Cent (approved)',
      });
      expect(result.items[1].possibleDuplicate).toBeNull();
    });

    it('uses the first match (oldest, as ordered by the query) when several approved coins match', async () => {
      mockPrismaService.coin.findMany
        .mockResolvedValueOnce([makeRow()])
        .mockResolvedValueOnce([
          makeApproved({ id: 'older', name: 'Older' }),
          makeApproved({ id: 'newer', name: 'Newer', country: 'usa' }),
        ]);

      const result = await service.findCoins(makeQuery());

      expect(result.items[0].possibleDuplicate).toEqual({ id: 'older', name: 'Older' });
    });
  });

  describe('reviewCoin — validation and final decisions (criteria #8, #10)', () => {
    it('throws BadRequestException for status approved with a rejectionReason, before any DB call', async () => {
      await expect(
        service.reviewCoin(COIN_ID, makeReviewDto({ status: 'approved', rejectionReason: 'nope' })),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.coin.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.coin.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException("Coin not found") for an unknown id, without updating', async () => {
      mockPrismaService.coin.findUnique.mockResolvedValue(null);

      const promise = service.reviewCoin(COIN_ID, makeReviewDto());
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Coin not found');

      expect(mockPrismaService.coin.update).not.toHaveBeenCalled();
    });

    it('looks the coin up by id', async () => {
      mockPrismaService.coin.findUnique.mockResolvedValue({ id: COIN_ID, status: 'pending' });
      mockPrismaService.coin.update.mockResolvedValue(makeRow({ id: COIN_ID, status: 'approved' }));

      await service.reviewCoin(COIN_ID, makeReviewDto());

      expect(mockPrismaService.coin.findUnique.mock.calls[0][0].where).toEqual({ id: COIN_ID });
    });

    it.each(['approved', 'rejected'])(
      'throws ConflictException("This coin has already been reviewed") when the coin is already %s, with no update',
      async (status) => {
        mockPrismaService.coin.findUnique.mockResolvedValue({ id: COIN_ID, status });

        const promise = service.reviewCoin(COIN_ID, makeReviewDto({ status: 'rejected' }));
        await expect(promise).rejects.toThrow(ConflictException);
        await expect(promise).rejects.toThrow('This coin has already been reviewed');

        expect(mockPrismaService.coin.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('reviewCoin — update data (criteria #8, #9, #13, #17)', () => {
    beforeEach(() => {
      mockPrismaService.coin.findUnique.mockResolvedValue({ id: COIN_ID, status: 'pending' });
      mockPrismaService.coin.update.mockImplementation(async (args: { data: Record<string, unknown> }) =>
        makeRow({ id: COIN_ID, ...args.data }),
      );
    });

    it('updates only a coin that is still pending (where: { id, status: "pending" })', async () => {
      await service.reviewCoin(COIN_ID, makeReviewDto());

      expect(mockPrismaService.coin.update.mock.calls[0][0].where).toEqual({ id: COIN_ID, status: 'pending' });
    });

    it('approve without edits writes status approved and a null rejectionReason, and no edit fields', async () => {
      await service.reviewCoin(COIN_ID, makeReviewDto({ status: 'approved' }));

      const { data } = mockPrismaService.coin.update.mock.calls[0][0];
      expect(data.status).toBe('approved');
      expect(data.rejectionReason).toBeNull();
      for (const key of ['country', 'denomination', 'name', 'year', 'mintMark', 'variety']) {
        expect(data).not.toHaveProperty(key);
      }
    });

    it('reject with a reason stores the reason', async () => {
      await service.reviewCoin(COIN_ID, makeReviewDto({ status: 'rejected', rejectionReason: 'Duplicate of another coin' }));

      const { data } = mockPrismaService.coin.update.mock.calls[0][0];
      expect(data.status).toBe('rejected');
      expect(data.rejectionReason).toBe('Duplicate of another coin');
    });

    it('reject with a different reason stores that reason (not a constant)', async () => {
      await service.reviewCoin(COIN_ID, makeReviewDto({ status: 'rejected', rejectionReason: 'Blurry photo' }));

      expect(mockPrismaService.coin.update.mock.calls[0][0].data.rejectionReason).toBe('Blurry photo');
    });

    it('reject without a reason stores null', async () => {
      await service.reviewCoin(COIN_ID, makeReviewDto({ status: 'rejected' }));

      expect(mockPrismaService.coin.update.mock.calls[0][0].data.rejectionReason).toBeNull();
    });

    it('reject with an empty-string reason stores null', async () => {
      await service.reviewCoin(COIN_ID, makeReviewDto({ status: 'rejected', rejectionReason: '' }));

      expect(mockPrismaService.coin.update.mock.calls[0][0].data.rejectionReason).toBeNull();
    });

    it('includes every edit field that is defined, applied together with the status change', async () => {
      await service.reviewCoin(
        COIN_ID,
        makeReviewDto({
          status: 'approved',
          country: 'Canada',
          denomination: '5 Cents',
          name: 'Beaver Nickel',
          year: 1937,
          mintMark: 'M',
          variety: 'Dot',
        }),
      );

      const { data } = mockPrismaService.coin.update.mock.calls[0][0];
      expect(data).toEqual({
        status: 'approved',
        rejectionReason: null,
        country: 'Canada',
        denomination: '5 Cents',
        name: 'Beaver Nickel',
        year: 1937,
        mintMark: 'M',
        variety: 'Dot',
      });
    });

    it('includes only the edit fields that were provided (a partial edit leaves the others out)', async () => {
      await service.reviewCoin(COIN_ID, makeReviewDto({ status: 'approved', name: 'Fixed Name' }));

      const { data } = mockPrismaService.coin.update.mock.calls[0][0];
      expect(data.name).toBe('Fixed Name');
      expect(data).not.toHaveProperty('country');
      expect(data).not.toHaveProperty('year');
      expect(data).not.toHaveProperty('mintMark');
    });

    it('writes an empty-string mintMark/variety edit (defined, so it clears the value)', async () => {
      await service.reviewCoin(COIN_ID, makeReviewDto({ status: 'approved', mintMark: '', variety: '' }));

      const { data } = mockPrismaService.coin.update.mock.calls[0][0];
      expect(data.mintMark).toBe('');
      expect(data.variety).toBe('');
    });

    it('never writes submittedByUserId, even if one sneaks onto the dto object', async () => {
      const dto = Object.assign(makeReviewDto({ status: 'approved' }), { submittedByUserId: 'someone-else' });

      await service.reviewCoin(COIN_ID, dto);

      expect(mockPrismaService.coin.update.mock.calls[0][0].data).not.toHaveProperty('submittedByUserId');
    });

    it('selects submitter email and rejectionReason, never submittedByUserId (criterion #14)', async () => {
      await service.reviewCoin(COIN_ID, makeReviewDto());

      const { select } = mockPrismaService.coin.update.mock.calls[0][0];
      expect(select.submitter).toEqual({ select: { email: true } });
      expect(select.rejectionReason).toBe(true);
      expect(select.submittedByUserId).toBeUndefined();
    });

    it('returns an AdminCoin: submitterEmail present, no submitter / submittedByUserId / possibleDuplicate key', async () => {
      mockPrismaService.coin.update.mockResolvedValue(
        makeRow({ id: COIN_ID, status: 'approved', submitter: { email: 'submitter@example.com' } }),
      );

      const result = await service.reviewCoin(COIN_ID, makeReviewDto());

      expect(result.id).toBe(COIN_ID);
      expect(result.status).toBe('approved');
      expect(result.submitterEmail).toBe('submitter@example.com');
      expect(result).not.toHaveProperty('submitter');
      expect(result).not.toHaveProperty('submittedByUserId');
      expect(result).not.toHaveProperty('possibleDuplicate');
    });

    it('returns submitterEmail null when the submitter account was deleted', async () => {
      mockPrismaService.coin.update.mockResolvedValue(makeRow({ id: COIN_ID, submitter: null }));

      const result = await service.reviewCoin(COIN_ID, makeReviewDto());

      expect(result.submitterEmail).toBeNull();
    });

    it('does not run the duplicates query during a review', async () => {
      await service.reviewCoin(COIN_ID, makeReviewDto());

      expect(mockPrismaService.coin.findMany).not.toHaveBeenCalled();
    });
  });

  describe('reviewCoin — update failures (criterion #10, open question)', () => {
    beforeEach(() => {
      mockPrismaService.coin.findUnique.mockResolvedValue({ id: COIN_ID, status: 'pending' });
    });

    it('maps P2002 (unique natural key) to ConflictException with the POST /catalog message', async () => {
      mockPrismaService.coin.update.mockRejectedValue(makeKnownError('P2002'));

      const promise = service.reviewCoin(COIN_ID, makeReviewDto({ country: 'USA' }));
      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow('A coin with this natural key already exists');
    });

    it('maps P2025 (no longer pending: concurrent review) to ConflictException("This coin has already been reviewed")', async () => {
      mockPrismaService.coin.update.mockRejectedValue(makeKnownError('P2025'));

      const promise = service.reviewCoin(COIN_ID, makeReviewDto());
      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow('This coin has already been reviewed');
    });

    it('rethrows a different Prisma error code unchanged', async () => {
      const other = makeKnownError('P2003');
      mockPrismaService.coin.update.mockRejectedValue(other);

      await expect(service.reviewCoin(COIN_ID, makeReviewDto())).rejects.toBe(other);
    });

    it('rethrows a non-Prisma error unchanged (not swallowed as a 409)', async () => {
      mockPrismaService.coin.update.mockRejectedValue(new Error('connection reset'));

      await expect(service.reviewCoin(COIN_ID, makeReviewDto())).rejects.toThrow('connection reset');
    });
  });
});
