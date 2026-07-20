/**
 * Tests for: CollectionService
 * Contract source: runs/run_20260720_142942/plan.md § Interface Contract (Service: CollectionService)
 * Covers criteria: #3, #4, #5, #6, #8 (from runs/run_20260720_142942/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (ownership.upsert, ownership.deleteMany, ownership.findMany)
 * — no real DB or network call. The P2003 branch is exercised by throwing a real
 * Prisma.PrismaClientKnownRequestError instance (constructed with the real class from
 * @prisma/client, which is a dependency of apps/api) rather than a plain object, so the
 * `err instanceof Prisma.PrismaClientKnownRequestError` check in the implementation is
 * exercised faithfully, not bypassed by a shape-alike mock.
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CollectionService } from './collection.service';
import { PrismaService } from '../prisma/prisma.service';
import { FindCollectionQueryDto } from './dto/find-collection-query.dto';

function makeQuery(overrides: Partial<FindCollectionQueryDto> = {}): FindCollectionQueryDto {
  return Object.assign(new FindCollectionQueryDto(), overrides);
}

function makeP2003Error(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
    code: 'P2003',
    clientVersion: '6.19.3',
  });
}

describe('CollectionService', () => {
  let service: CollectionService;
  let mockPrismaService: {
    ownership: {
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const userId = 'user-1';
  const coinId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  beforeEach(async () => {
    mockPrismaService = {
      ownership: {
        upsert: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CollectionService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get(CollectionService);
  });

  describe('setOwnership — owned: true (criterion #3)', () => {
    it('upserts with the composite key, create, and an empty update object', async () => {
      const ownedAt = new Date('2026-01-01T00:00:00.000Z');
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt });

      await service.setOwnership(userId, coinId, true);

      expect(mockPrismaService.ownership.upsert).toHaveBeenCalledWith({
        where: { userId_coinId: { userId, coinId } },
        create: { userId, coinId },
        update: {},
      });
      expect(mockPrismaService.ownership.deleteMany).not.toHaveBeenCalled();
    });

    it('returns { coinId, owned: true, ownedAt } from the upsert result', async () => {
      const ownedAt = new Date('2026-01-01T00:00:00.000Z');
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt });

      const result = await service.setOwnership(userId, coinId, true);

      expect(result).toEqual({ coinId, owned: true, ownedAt });
    });

    it('re-upserting an already-owned coin preserves the original ownedAt (no error, same timestamp both times)', async () => {
      const originalOwnedAt = new Date('2025-06-01T00:00:00.000Z');
      // update: {} means Prisma writes nothing on conflict — the mock returns the
      // pre-existing row's ownedAt unchanged both times, since a real upsert with an
      // empty update object cannot itself have modified it.
      mockPrismaService.ownership.upsert.mockResolvedValue({
        userId,
        coinId,
        ownedAt: originalOwnedAt,
      });

      const first = await service.setOwnership(userId, coinId, true);
      const second = await service.setOwnership(userId, coinId, true);

      expect(first.ownedAt).toEqual(originalOwnedAt);
      expect(second.ownedAt).toEqual(originalOwnedAt);
      expect(mockPrismaService.ownership.upsert).toHaveBeenCalledTimes(2);
    });

    it('maps a P2003 (foreign key violation) error to NotFoundException, not a raw 500', async () => {
      mockPrismaService.ownership.upsert.mockRejectedValue(makeP2003Error());

      await expect(service.setOwnership(userId, coinId, true)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rethrows any other error unchanged (not swallowed as a 404)', async () => {
      const otherError = new Error('unexpected failure');
      mockPrismaService.ownership.upsert.mockRejectedValue(otherError);

      await expect(service.setOwnership(userId, coinId, true)).rejects.toThrow(
        'unexpected failure',
      );
    });
  });

  describe('setOwnership — owned: false (criterion #4)', () => {
    it('calls deleteMany scoped to userId and coinId, never upsert', async () => {
      await service.setOwnership(userId, coinId, false);

      expect(mockPrismaService.ownership.deleteMany).toHaveBeenCalledWith({
        where: { userId, coinId },
      });
      expect(mockPrismaService.ownership.upsert).not.toHaveBeenCalled();
    });

    it('returns { coinId, owned: false, ownedAt: null }', async () => {
      const result = await service.setOwnership(userId, coinId, false);

      expect(result).toEqual({ coinId, owned: false, ownedAt: null });
    });

    it('does not throw when the coin was never owned (deleteMany matches zero rows)', async () => {
      mockPrismaService.ownership.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.setOwnership(userId, coinId, false)).resolves.toEqual({
        coinId,
        owned: false,
        ownedAt: null,
      });
    });
  });

  describe('findAll — no filters (criterion #7)', () => {
    it('scopes the query to userId with an empty coin filter', async () => {
      await service.findAll(userId, makeQuery());

      const call = mockPrismaService.ownership.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe(userId);
      expect(call.where.coin).toEqual({});
      expect(call.include).toEqual({ coin: true });
    });

    it('returns whatever prisma resolves', async () => {
      const rows = [
        {
          coinId,
          coin: { id: coinId, country: 'USA', year: 1943 },
          ownedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ];
      mockPrismaService.ownership.findMany.mockResolvedValue(rows);

      const result = await service.findAll(userId, makeQuery());

      expect(result).toBe(rows);
    });
  });

  describe('findAll — country/year filters (criterion #8)', () => {
    it('adds country to the coin relation filter when provided', async () => {
      await service.findAll(userId, makeQuery({ country: 'USA' }));

      const call = mockPrismaService.ownership.findMany.mock.calls[0][0];
      expect(call.where.coin.country).toBe('USA');
      expect(call.where.coin.year).toBeUndefined();
    });

    it('adds year to the coin relation filter when provided', async () => {
      await service.findAll(userId, makeQuery({ year: 1943 }));

      const call = mockPrismaService.ownership.findMany.mock.calls[0][0];
      expect(call.where.coin.year).toBe(1943);
      expect(call.where.coin.country).toBeUndefined();
    });

    it('combines both filters when both are provided', async () => {
      await service.findAll(userId, makeQuery({ country: 'USA', year: 1943 }));

      const call = mockPrismaService.ownership.findMany.mock.calls[0][0];
      expect(call.where.coin).toEqual({ country: 'USA', year: 1943 });
    });

    it('only returns rows matching the filter (simulated at the mock boundary — the real filtering happens in Postgres)', async () => {
      const matching = [
        { coinId, coin: { id: coinId, country: 'USA', year: 1943 }, ownedAt: new Date() },
      ];
      mockPrismaService.ownership.findMany.mockResolvedValue(matching);

      const result = await service.findAll(userId, makeQuery({ country: 'USA', year: 1943 }));

      expect(result).toBe(matching);
      expect(result.every((r) => r.coin.country === 'USA' && r.coin.year === 1943)).toBe(true);
    });
  });
});
