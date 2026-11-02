/**
 * Tests for: CollectionService
 * Contract source: runs/run_20260720_142942/plan.md § Interface Contract (Service: CollectionService)
 * Extended by: runs/run_20261017_210503/plan.md § Interface Contract (API: PATCH /collection)
 *              runs/run_20261102_194108/plan.md § Interface Contract (API: PATCH /collection/:coinId)
 * Covers criteria: #3, #4, #5, #6, #8 (run_20260720_142942); #10 (run_20261017_210503);
 *                  #5, #6, #7, #9 (run_20261102_194108)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (ownership.upsert, ownership.deleteMany, ownership.findMany,
 * ownership.createMany, coin.count) — no real DB or network call. The P2003 branch is exercised
 * by throwing a real Prisma.PrismaClientKnownRequestError instance (constructed with the real
 * class from @prisma/client, which is a dependency of apps/api) rather than a plain object, so
 * the `err instanceof Prisma.PrismaClientKnownRequestError` check in the implementation is
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
      createMany: jest.Mock;
    };
    coin: {
      count: jest.Mock;
    };
  };

  const userId = 'user-1';
  const coinId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
  const coinIdB = '9b2e4f1c-8d3a-4c5b-a6e7-1f2d3c4b5a69';
  const coinIdC = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

  beforeEach(async () => {
    mockPrismaService = {
      ownership: {
        upsert: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      coin: {
        count: jest.fn().mockResolvedValue(0),
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
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt, grade: null });

      await service.setOwnership(userId, coinId, true);

      expect(mockPrismaService.ownership.upsert).toHaveBeenCalledWith({
        where: { userId_coinId: { userId, coinId } },
        create: { userId, coinId },
        update: {},
      });
      expect(mockPrismaService.ownership.deleteMany).not.toHaveBeenCalled();
    });

    it('returns { coinId, owned: true, ownedAt, grade } from the upsert result', async () => {
      const ownedAt = new Date('2026-01-01T00:00:00.000Z');
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt, grade: null });

      const result = await service.setOwnership(userId, coinId, true);

      expect(result).toEqual({ coinId, owned: true, ownedAt, grade: null });
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
        grade: null,
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

  describe('setOwnership — grade on owned: true (criteria #5, #6 from run_20261102_194108)', () => {
    const ownedAt = new Date('2026-01-01T00:00:00.000Z');

    it('treats an explicit undefined grade like an absent one: create { userId, coinId }, update {}', async () => {
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt, grade: 'XF' });

      await service.setOwnership(userId, coinId, true, undefined);

      const arg = mockPrismaService.ownership.upsert.mock.calls[0][0];
      expect(arg.create).toEqual({ userId, coinId });
      expect(arg.create).not.toHaveProperty('grade');
      expect(arg.update).toEqual({});
    });

    it('a grade sets it on create and on update', async () => {
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt, grade: 'VF' });

      await service.setOwnership(userId, coinId, true, 'VF');

      expect(mockPrismaService.ownership.upsert).toHaveBeenCalledWith({
        where: { userId_coinId: { userId, coinId } },
        create: { userId, coinId, grade: 'VF' },
        update: { grade: 'VF' },
      });
    });

    it('a different grade writes that grade (the value is not hard-coded)', async () => {
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt, grade: 'UNC' });

      await service.setOwnership(userId, coinId, true, 'UNC');

      const arg = mockPrismaService.ownership.upsert.mock.calls[0][0];
      expect(arg.create).toEqual({ userId, coinId, grade: 'UNC' });
      expect(arg.update).toEqual({ grade: 'UNC' });
    });

    it('grade: null clears the stored grade on update', async () => {
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt, grade: null });

      await service.setOwnership(userId, coinId, true, null);

      const arg = mockPrismaService.ownership.upsert.mock.calls[0][0];
      expect(arg.update).toEqual({ grade: null });
      expect(arg.create).toEqual({ userId, coinId, grade: null });
    });

    it('returns the grade from the upsert row', async () => {
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt, grade: 'VF' });
      const withGrade = await service.setOwnership(userId, coinId, true, 'VF');

      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt, grade: null });
      const cleared = await service.setOwnership(userId, coinId, true, null);

      expect(withGrade).toEqual({ coinId, owned: true, ownedAt, grade: 'VF' });
      expect(cleared).toEqual({ coinId, owned: true, ownedAt, grade: null });
    });

    it('re-marking owned without a grade returns the kept grade from the existing row', async () => {
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt, grade: 'XF' });

      const result = await service.setOwnership(userId, coinId, true);

      expect(result.grade).toBe('XF');
      expect(mockPrismaService.ownership.upsert.mock.calls[0][0].update).toEqual({});
    });

    it('returns grade null when the upsert row has no grade value (undefined from a bare row)', async () => {
      mockPrismaService.ownership.upsert.mockResolvedValue({ userId, coinId, ownedAt });

      const result = await service.setOwnership(userId, coinId, true);

      expect(result.grade).toBeNull();
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

    it('returns { coinId, owned: false, ownedAt: null, grade: null }', async () => {
      const result = await service.setOwnership(userId, coinId, false);

      expect(result).toEqual({ coinId, owned: false, ownedAt: null, grade: null });
    });

    it('does not throw when the coin was never owned (deleteMany matches zero rows)', async () => {
      mockPrismaService.ownership.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.setOwnership(userId, coinId, false)).resolves.toEqual({
        coinId,
        owned: false,
        ownedAt: null,
        grade: null,
      });
    });

    it('ignores a grade argument: only deleteMany runs and the response grade is null (criterion #5 from run_20261102_194108)', async () => {
      const result = await service.setOwnership(userId, coinId, false, 'VF');

      expect(mockPrismaService.ownership.deleteMany).toHaveBeenCalledWith({
        where: { userId, coinId },
      });
      expect(mockPrismaService.ownership.upsert).not.toHaveBeenCalled();
      expect(result).toEqual({ coinId, owned: false, ownedAt: null, grade: null });
    });
  });

  describe('setOwnershipBulk — owned: true (criterion #10)', () => {
    it('checks the coins exist, then createMany with skipDuplicates scoped to the user', async () => {
      mockPrismaService.coin.count.mockResolvedValue(2);

      await service.setOwnershipBulk(userId, [coinId, coinIdB], true);

      expect(mockPrismaService.coin.count).toHaveBeenCalledWith({
        where: { id: { in: [coinId, coinIdB] } },
      });
      expect(mockPrismaService.ownership.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.ownership.createMany).toHaveBeenCalledWith({
        data: [
          { userId, coinId },
          { userId, coinId: coinIdB },
        ],
        skipDuplicates: true,
      });
      expect(mockPrismaService.ownership.deleteMany).not.toHaveBeenCalled();
    });

    it('never writes a grade and never upserts, so existing grades survive (criterion #7 from run_20261102_194108)', async () => {
      mockPrismaService.coin.count.mockResolvedValue(2);

      await service.setOwnershipBulk(userId, [coinId, coinIdB], true);

      const arg = mockPrismaService.ownership.createMany.mock.calls[0][0] as {
        data: Record<string, unknown>[];
      };
      for (const row of arg.data) {
        expect(Object.keys(row).sort()).toEqual(['coinId', 'userId']);
        expect(row).not.toHaveProperty('grade');
      }
      expect(mockPrismaService.ownership.upsert).not.toHaveBeenCalled();
    });

    it('returns { coinIds, owned: true }', async () => {
      mockPrismaService.coin.count.mockResolvedValue(2);

      const result = await service.setOwnershipBulk(userId, [coinId, coinIdB], true);

      expect(result).toEqual({ coinIds: [coinId, coinIdB], owned: true });
    });

    it('de-duplicates ids keeping first-seen order, for the count check, the insert and the result', async () => {
      mockPrismaService.coin.count.mockResolvedValue(3);

      const result = await service.setOwnershipBulk(
        userId,
        [coinIdB, coinId, coinIdB, coinIdC, coinId],
        true,
      );

      expect(mockPrismaService.coin.count).toHaveBeenCalledWith({
        where: { id: { in: [coinIdB, coinId, coinIdC] } },
      });
      expect(mockPrismaService.ownership.createMany).toHaveBeenCalledWith({
        data: [
          { userId, coinId: coinIdB },
          { userId, coinId },
          { userId, coinId: coinIdC },
        ],
        skipDuplicates: true,
      });
      expect(result.coinIds).toEqual([coinIdB, coinId, coinIdC]);
    });

    it('throws NotFoundException and writes nothing when a coin does not exist', async () => {
      mockPrismaService.coin.count.mockResolvedValue(1);

      await expect(service.setOwnershipBulk(userId, [coinId, coinIdB], true)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.ownership.createMany).not.toHaveBeenCalled();
    });

    it('does not 404 when duplicates in the input would exceed the count but every distinct coin exists', async () => {
      mockPrismaService.coin.count.mockResolvedValue(1);

      await expect(service.setOwnershipBulk(userId, [coinId, coinId], true)).resolves.toEqual({
        coinIds: [coinId],
        owned: true,
      });
    });

    it('maps a P2003 from the insert to NotFoundException', async () => {
      mockPrismaService.coin.count.mockResolvedValue(1);
      mockPrismaService.ownership.createMany.mockRejectedValue(makeP2003Error());

      await expect(service.setOwnershipBulk(userId, [coinId], true)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rethrows any other insert error unchanged', async () => {
      mockPrismaService.coin.count.mockResolvedValue(1);
      mockPrismaService.ownership.createMany.mockRejectedValue(new Error('db down'));

      await expect(service.setOwnershipBulk(userId, [coinId], true)).rejects.toThrow('db down');
    });

    it('is idempotent: owning already-owned coins (createMany count 0) still succeeds', async () => {
      mockPrismaService.coin.count.mockResolvedValue(1);
      mockPrismaService.ownership.createMany.mockResolvedValue({ count: 0 });

      await expect(service.setOwnershipBulk(userId, [coinId], true)).resolves.toEqual({
        coinIds: [coinId],
        owned: true,
      });
    });
  });

  describe('setOwnershipBulk — owned: false (criterion #10)', () => {
    it('deleteMany scoped to the user and the ids, never createMany or a coin lookup', async () => {
      await service.setOwnershipBulk(userId, [coinId, coinIdB], false);

      expect(mockPrismaService.ownership.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.ownership.deleteMany).toHaveBeenCalledWith({
        where: { userId, coinId: { in: [coinId, coinIdB] } },
      });
      expect(mockPrismaService.ownership.createMany).not.toHaveBeenCalled();
      expect(mockPrismaService.coin.count).not.toHaveBeenCalled();
    });

    it('returns { coinIds, owned: false } with de-duplicated ids', async () => {
      const result = await service.setOwnershipBulk(userId, [coinIdB, coinId, coinIdB], false);

      expect(result).toEqual({ coinIds: [coinIdB, coinId], owned: false });
      expect(mockPrismaService.ownership.deleteMany).toHaveBeenCalledWith({
        where: { userId, coinId: { in: [coinIdB, coinId] } },
      });
    });

    it('is idempotent: un-owning coins that were never owned does not throw', async () => {
      mockPrismaService.ownership.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.setOwnershipBulk(userId, [coinId], false)).resolves.toEqual({
        coinIds: [coinId],
        owned: false,
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

    it('returns whatever prisma resolves, grade included (criterion #9 from run_20261102_194108)', async () => {
      const rows = [
        {
          coinId,
          coin: { id: coinId, country: 'USA', year: 1943 },
          ownedAt: new Date('2026-01-01T00:00:00.000Z'),
          grade: 'VF',
        },
        {
          coinId: coinIdB,
          coin: { id: coinIdB, country: 'USA', year: 1944 },
          ownedAt: new Date('2026-01-02T00:00:00.000Z'),
          grade: null,
        },
      ];
      mockPrismaService.ownership.findMany.mockResolvedValue(rows);

      const result = await service.findAll(userId, makeQuery());

      expect(result).toBe(rows);
      expect(result.map((r) => r.grade)).toEqual(['VF', null]);
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
        {
          coinId,
          coin: { id: coinId, country: 'USA', year: 1943 },
          ownedAt: new Date(),
          grade: null,
        },
      ];
      mockPrismaService.ownership.findMany.mockResolvedValue(matching);

      const result = await service.findAll(userId, makeQuery({ country: 'USA', year: 1943 }));

      expect(result).toBe(matching);
      expect(result.every((r) => r.coin.country === 'USA' && r.coin.year === 1943)).toBe(true);
    });
  });
});
