/**
 * Tests for: SetsService
 * Contract source: runs/run_20260719_200109/plan.md § Interface Contract (Service: SetsService)
 *                   runs/run_20260720_070901/plan.md § Interface Contract (Service: SetsService)
 *                   runs/run_20260720_142942/plan.md § Interface Contract (Service: SetsService — new method)
 *                   runs/run_20260720_171320/plan.md § Interface Contract (Test addition: getGaps — no-coins-owned case)
 *                   runs/run_20261013_062900/plan.md § Interface Contract (API: SetsService — coinCount on list methods)
 *                   runs/run_20261018_105617/plan.md § Interface Contract (API: GET /sets, GET /sets/summary)
 * Covers criteria: #1, #3, #4, #5, #6, #7, #8, #9, #10 (from runs/run_20260719_200109/prd.md)
 *                   #1, #2 [validated in dto spec, not here], #3, #4, #5, #6, #7, #8, #9, #10,
 *                   #11, #12, #17 (from runs/run_20260720_070901/prd.md)
 *                   #9, #10, #11 (from runs/run_20260720_142942/prd.md)
 *                   #10 (from runs/run_20260720_171320/prd.md — pins the nonzero-total/zero-owned
 *                   gap-computation case, distinct from the pre-existing zero-*coin*-set case)
 *                   #18, #19, #20 (from runs/run_20261013_062900/prd.md — coinCount from Prisma _count
 *                   on findAllCanonical and findAllPublic, with no _count key leaking out)
 *                   #2, #3, #7 (from runs/run_20261018_105617/prd.md — findAllForUser progress fields,
 *                   getSummary unique-missing dedupe / no sets / suggestion)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (userSet.*, userSetCoin.*, canonicalSetCoin.findMany,
 * canonicalSet.*, ownership.*, $transaction) — no real DB or network call. Per plan.md's
 * "exact Prisma calls the Tester's mock must cover" list for patchCoins, $transaction is
 * mocked to invoke its callback with the same mock object used elsewhere, so assertions on
 * e.g. `mockPrismaService.userSetCoin.aggregate` work whether the implementation calls it via
 * the outer `this.prisma` or the transaction callback's `tx` argument — both resolve to the
 * identical mock in this harness (a known limitation of unit-level Prisma transaction testing,
 * documented in plan.md's Risks section; it does not change what is asserted here).
 *
 * For getGaps (run_20260720_142942), userSet.findUnique's fixture stands in for the real
 * Prisma nested include (`coins.coin.ownerships` filtered to `where: { userId: callerId }`
 * at the DB layer) — the mock's `coins[].coin.ownerships` array is pre-shaped as if that
 * filter already ran, since a mocked Prisma client cannot itself apply a WHERE clause.
 *
 * The same holds for findAllForUser and getSummary (run_20261018_105617): the mocked rows are
 * pre-shaped as if the WHERE / include filters already ran.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SetsService } from './sets.service';
import { PrismaService } from '../prisma/prisma.service';
import { FindPublicSetsQueryDto } from './dto/find-public-sets-query.dto';

function makePublicQuery(overrides: Partial<FindPublicSetsQueryDto> = {}): FindPublicSetsQueryDto {
  return Object.assign(new FindPublicSetsQueryDto(), overrides);
}

describe('SetsService', () => {
  let service: SetsService;
  let mockPrismaService: {
    userSet: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    userSetCoin: {
      findMany: jest.Mock;
      createMany: jest.Mock;
      deleteMany: jest.Mock;
      aggregate: jest.Mock;
    };
    canonicalSet: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    canonicalSetCoin: {
      findMany: jest.Mock;
    };
    ownership: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const uuidA = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
  const uuidB = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  const uuidC = 'e2c56db5-dffb-48d3-b1c4-63c7981a9b46';

  beforeEach(async () => {
    mockPrismaService = {
      userSet: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      userSetCoin: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        aggregate: jest.fn().mockResolvedValue({ _max: { position: null } }),
      },
      canonicalSet: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      canonicalSetCoin: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ownership: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockPrismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SetsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get(SetsService);
  });

  describe('findAllForUser (criterion #1 from run_20260719_200109/prd.md)', () => {
    it('scopes the query to the given userId', async () => {
      await service.findAllForUser('user-1');

      const call = mockPrismaService.userSet.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe('user-1');
    });

    it('returns an empty array when the user has no sets', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([]);

      await expect(service.findAllForUser('user-1')).resolves.toEqual([]);
    });
  });

  describe('findAllForUser — progress fields (criterion #2 from run_20261018_105617/prd.md)', () => {
    function makeCoin(name: string, owned: boolean, extra: Record<string, unknown> = {}) {
      return {
        coinId: `coin-${name}`,
        coin: {
          country: 'Ukraine',
          denomination: '10 Hryvnias',
          year: 2022,
          mintMark: '',
          variety: '',
          name,
          isKeyDate: false,
          ownerships: owned ? [{ coinId: `coin-${name}` }] : [],
          ...extra,
        },
      };
    }

    function makeRow(id: string, name: string, coins: ReturnType<typeof makeCoin>[]) {
      return {
        id,
        userId: 'user-1',
        name,
        clonedFromCanonicalId: null,
        clonedFromUserSetId: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        coins,
      };
    }

    it('asks Prisma for one query ordered by createdAt asc with coins ordered by position and ownerships scoped to the caller', async () => {
      await service.findAllForUser('user-1');

      expect(mockPrismaService.userSet.findMany).toHaveBeenCalledTimes(1);
      const call = mockPrismaService.userSet.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ userId: 'user-1' });
      expect(call.orderBy).toEqual({ createdAt: 'asc' });
      expect(call.include.coins.orderBy).toEqual({ position: 'asc' });
      expect(call.include.coins.select.coin.select.ownerships).toEqual({
        where: { userId: 'user-1' },
        select: { coinId: true },
      });
      expect(mockPrismaService.userSetCoin.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.findMany).not.toHaveBeenCalled();
    });

    it('adds ownedCount, totalCount and firstMissing and keeps the existing set fields', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([
        makeRow('set-1', 'We Are Strong', [
          makeCoin('Kyiv Oblast', true),
          makeCoin('Odesa Oblast', false),
          makeCoin('Lviv Oblast', true),
          makeCoin('Zaporizhzhia Oblast', false),
        ]),
      ]);

      const result = await service.findAllForUser('user-1');

      expect(result).toEqual([
        {
          id: 'set-1',
          userId: 'user-1',
          name: 'We Are Strong',
          clonedFromCanonicalId: null,
          clonedFromUserSetId: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          ownedCount: 2,
          totalCount: 4,
          firstMissing: 'Odesa Oblast',
        },
      ]);
    });

    it('does not leak the coins key into the response', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([
        makeRow('set-1', 'A', [makeCoin('Kyiv Oblast', true)]),
      ]);

      const result = await service.findAllForUser('user-1');

      expect(result[0]).not.toHaveProperty('coins');
    });

    it('takes firstMissing from the first unowned coin in position order, not the last', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([
        makeRow('set-1', 'A', [
          makeCoin('Kyiv Oblast', false),
          makeCoin('Odesa Oblast', false),
        ]),
      ]);

      const [first] = await service.findAllForUser('user-1');
      expect(first.firstMissing).toBe('Kyiv Oblast');

      mockPrismaService.userSet.findMany.mockResolvedValue([
        makeRow('set-1', 'A', [
          makeCoin('Kyiv Oblast', true),
          makeCoin('Odesa Oblast', false),
        ]),
      ]);

      const [second] = await service.findAllForUser('user-1');
      expect(second.firstMissing).toBe('Odesa Oblast');
    });

    it('uses the shared coin title (getCoinName), not the raw name field', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([
        makeRow('set-1', 'A', [
          makeCoin('Ukraine 10 Hryvnias', false, { year: 2019, mintMark: '', variety: '', isKeyDate: false }),
        ]),
      ]);

      const [item] = await service.findAllForUser('user-1');

      // The name only repeats the country and denomination, so the title falls back to the denomination.
      expect(item.firstMissing).toBe('10 Hryvnias');
    });

    it('returns firstMissing null and ownedCount equal to totalCount for a complete set', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([
        makeRow('set-1', 'Done', [makeCoin('Kyiv Oblast', true), makeCoin('Odesa Oblast', true)]),
      ]);

      const [item] = await service.findAllForUser('user-1');

      expect(item.ownedCount).toBe(2);
      expect(item.totalCount).toBe(2);
      expect(item.firstMissing).toBeNull();
    });

    it('returns 0, 0 and null for a set with no coins', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([makeRow('set-1', 'Empty', [])]);

      const [item] = await service.findAllForUser('user-1');

      expect(item.ownedCount).toBe(0);
      expect(item.totalCount).toBe(0);
      expect(item.firstMissing).toBeNull();
    });

    it('gives every set its own counts and preserves the row order', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([
        makeRow('set-1', 'First', [makeCoin('Kyiv Oblast', true), makeCoin('Odesa Oblast', false)]),
        makeRow('set-2', 'Second', [
          makeCoin('Lviv Oblast', false),
          makeCoin('Sumy Oblast', false),
          makeCoin('Poltava Oblast', false),
        ]),
      ]);

      const result = await service.findAllForUser('user-1');

      expect(result.map((r) => r.id)).toEqual(['set-1', 'set-2']);
      expect(result.map((r) => r.ownedCount)).toEqual([1, 0]);
      expect(result.map((r) => r.totalCount)).toEqual([2, 3]);
      expect(result.map((r) => r.firstMissing)).toEqual(['Odesa Oblast', 'Lviv Oblast']);
    });
  });

  describe('getSummary (criteria #3, #7 from run_20261018_105617/prd.md)', () => {
    const canonical = (id: string, name: string, coins: number) => ({
      id,
      name,
      description: null,
      source: 'admin',
      templateVersion: '1',
      _count: { coins },
    });

    const ownedTally = (canonicalSetId: string, times: number) =>
      Array.from({ length: times }, () => ({ canonicalSetId }));

    beforeEach(() => {
      mockPrismaService.userSetCoin.findMany.mockResolvedValue([]);
      mockPrismaService.ownership.count.mockResolvedValue(0);
      mockPrismaService.userSet.findMany.mockResolvedValue([]);
      mockPrismaService.canonicalSetCoin.findMany.mockResolvedValue([]);
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([]);
    });

    it('scopes every read to the caller', async () => {
      await service.getSummary('user-1');

      expect(mockPrismaService.userSetCoin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userSet: { userId: 'user-1' }, coin: { ownerships: { none: { userId: 'user-1' } } } },
          select: { coinId: true },
        }),
      );
      expect(mockPrismaService.ownership.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(mockPrismaService.userSet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          select: { clonedFromCanonicalId: true },
        }),
      );
      expect(mockPrismaService.canonicalSetCoin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { coin: { ownerships: { some: { userId: 'user-1' } } } },
          select: { canonicalSetId: true },
        }),
      );
    });

    it('counts a coin missing from two sets once', async () => {
      mockPrismaService.userSetCoin.findMany.mockResolvedValue([
        { coinId: 'coin-a' },
        { coinId: 'coin-b' },
        { coinId: 'coin-a' },
      ]);

      const result = await service.getSummary('user-1');

      expect(result.uniqueMissingCount).toBe(2);
    });

    it('counts distinct coins when none repeat (different input gives a different count)', async () => {
      mockPrismaService.userSetCoin.findMany.mockResolvedValue([
        { coinId: 'coin-a' },
        { coinId: 'coin-b' },
        { coinId: 'coin-c' },
        { coinId: 'coin-d' },
      ]);

      const result = await service.getSummary('user-1');

      expect(result.uniqueMissingCount).toBe(4);
    });

    it('returns uniqueMissingCount 0 for a user with no sets', async () => {
      const result = await service.getSummary('user-1');

      expect(result.uniqueMissingCount).toBe(0);
      expect(result.suggestedSet).toBeNull();
    });

    it('returns collectionCount from the ownership count', async () => {
      mockPrismaService.ownership.count.mockResolvedValue(17);
      const first = await service.getSummary('user-1');
      expect(first.collectionCount).toBe(17);

      mockPrismaService.ownership.count.mockResolvedValue(3);
      const second = await service.getSummary('user-1');
      expect(second.collectionCount).toBe(3);
    });

    it('suggests the unadded checklist with the most owned coins', async () => {
      mockPrismaService.canonicalSetCoin.findMany.mockResolvedValue([
        ...ownedTally('cs-small', 2),
        ...ownedTally('cs-big', 5),
      ]);
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([
        canonical('cs-small', 'Small Set', 10),
        canonical('cs-big', 'Big Set', 40),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.suggestedSet).toEqual({ id: 'cs-big', name: 'Big Set', coinCount: 40, ownedCount: 5 });
    });

    it('excludes checklists the user already cloned, even when they share the most coins', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([
        { clonedFromCanonicalId: 'cs-big' },
        { clonedFromCanonicalId: null },
      ]);
      mockPrismaService.canonicalSetCoin.findMany.mockResolvedValue([
        ...ownedTally('cs-small', 2),
        ...ownedTally('cs-big', 5),
      ]);
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([
        canonical('cs-small', 'Small Set', 10),
        canonical('cs-big', 'Big Set', 40),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.suggestedSet).toEqual({ id: 'cs-small', name: 'Small Set', coinCount: 10, ownedCount: 2 });
    });

    it('returns null when the only candidates were already cloned', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([{ clonedFromCanonicalId: 'cs-big' }]);
      mockPrismaService.canonicalSetCoin.findMany.mockResolvedValue(ownedTally('cs-big', 5));
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([canonical('cs-big', 'Big Set', 40)]);

      const result = await service.getSummary('user-1');

      expect(result.suggestedSet).toBeNull();
    });

    it('returns null when no checklist shares an owned coin', async () => {
      mockPrismaService.canonicalSetCoin.findMany.mockResolvedValue([]);
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([
        canonical('cs-a', 'Alpha', 10),
        canonical('cs-b', 'Beta', 20),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.suggestedSet).toBeNull();
    });

    it('breaks a tally tie by name', async () => {
      mockPrismaService.canonicalSetCoin.findMany.mockResolvedValue([
        ...ownedTally('cs-z', 3),
        ...ownedTally('cs-a', 3),
      ]);
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([
        canonical('cs-z', 'Zebra Set', 10),
        canonical('cs-a', 'Alpha Set', 10),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.suggestedSet?.id).toBe('cs-a');
    });

    it('breaks a tally and name tie by id', async () => {
      mockPrismaService.canonicalSetCoin.findMany.mockResolvedValue([
        ...ownedTally('cs-2', 3),
        ...ownedTally('cs-1', 3),
      ]);
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([
        canonical('cs-2', 'Same Name', 10),
        canonical('cs-1', 'Same Name', 10),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.suggestedSet?.id).toBe('cs-1');
    });

    it('ignores owned-coin rows for checklists that no longer exist', async () => {
      mockPrismaService.canonicalSetCoin.findMany.mockResolvedValue([
        ...ownedTally('cs-gone', 9),
        ...ownedTally('cs-a', 1),
      ]);
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([canonical('cs-a', 'Alpha', 10)]);

      const result = await service.getSummary('user-1');

      expect(result.suggestedSet?.id).toBe('cs-a');
    });
  });

  describe('create — blank set (criterion #3 from run_20260719_200109/prd.md)', () => {
    it('creates a UserSet with no cloneFrom and never touches userSetCoin or $transaction', async () => {
      const created = { id: 'set-new', userId: 'user-1', name: 'Blank Set' };
      mockPrismaService.userSet.create.mockResolvedValue(created);

      const result = await service.create('user-1', { name: 'Blank Set' } as never);

      expect(mockPrismaService.userSet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1', name: 'Blank Set' }),
        }),
      );
      expect(mockPrismaService.userSetCoin.createMany).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(result).toBe(created);
    });
  });

  describe('create — clone from canonical set (criteria #4, #6, #7 from run_20260719_200109/prd.md)', () => {
    it('copies CanonicalSetCoin rows verbatim (positions not renumbered) and sets clonedFromCanonicalId', async () => {
      const sourceId = '33333333-3333-3333-3333-333333333333';
      const sourceCoins = [
        { id: 'csc-1', canonicalSetId: sourceId, coinId: 'coin-a', position: 1 },
        { id: 'csc-2', canonicalSetId: sourceId, coinId: 'coin-b', position: 5 },
      ];
      mockPrismaService.canonicalSetCoin.findMany.mockResolvedValue(sourceCoins);
      const created = { id: 'set-clone', userId: 'user-1', name: 'Cloned Set' };
      mockPrismaService.userSet.create.mockResolvedValue(created);

      const result = await service.create('user-1', {
        name: 'Cloned Set',
        cloneFrom: { type: 'canonical', id: sourceId },
      } as never);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.canonicalSetCoin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ canonicalSetId: sourceId }) }),
      );
      expect(mockPrismaService.userSet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            name: 'Cloned Set',
            clonedFromCanonicalId: sourceId,
            clonedFromUserSetId: null,
          }),
        }),
      );
      const createManyArg = mockPrismaService.userSetCoin.createMany.mock.calls[0][0];
      expect(createManyArg.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userSetId: created.id, coinId: 'coin-a', position: 1 }),
          expect.objectContaining({ userSetId: created.id, coinId: 'coin-b', position: 5 }),
        ]),
      );
      expect(result).toBe(created);
    });
  });

  describe('create — clone from user set (criteria #5, #6, #7 from run_20260719_200109/prd.md)', () => {
    it('copies UserSetCoin rows from ANY set id (no owner filter) and sets clonedFromUserSetId', async () => {
      const sourceId = '44444444-4444-4444-4444-444444444444';
      const sourceCoins = [{ id: 'usc-1', userSetId: sourceId, coinId: 'coin-c', position: 2 }];
      mockPrismaService.userSetCoin.findMany.mockResolvedValue(sourceCoins);
      const created = { id: 'set-clone-2', userId: 'user-1', name: 'Cloned From User' };
      mockPrismaService.userSet.create.mockResolvedValue(created);

      const result = await service.create('user-1', {
        name: 'Cloned From User',
        cloneFrom: { type: 'user', id: sourceId },
      } as never);

      const findManyCall = mockPrismaService.userSetCoin.findMany.mock.calls[0][0];
      expect(findManyCall.where.userSetId).toBe(sourceId);
      expect(findManyCall.where.userId).toBeUndefined();
      expect(mockPrismaService.userSet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clonedFromUserSetId: sourceId,
            clonedFromCanonicalId: null,
          }),
        }),
      );
      const createManyArg = mockPrismaService.userSetCoin.createMany.mock.calls[0][0];
      expect(createManyArg.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userSetId: created.id, coinId: 'coin-c', position: 2 }),
        ]),
      );
      expect(result).toBe(created);
    });

    it('succeeds without throwing when the source set has zero coins', async () => {
      mockPrismaService.userSetCoin.findMany.mockResolvedValue([]);
      const created = { id: 'set-clone-3', userId: 'user-1', name: 'Empty Clone' };
      mockPrismaService.userSet.create.mockResolvedValue(created);

      await expect(
        service.create('user-1', {
          name: 'Empty Clone',
          cloneFrom: { type: 'user', id: '55555555-5555-5555-5555-555555555555' },
        } as never),
      ).resolves.toBe(created);
    });
  });

  describe('update — ownership check (criterion #8 from run_20260719_200109/prd.md)', () => {
    const id = '66666666-6666-6666-6666-666666666666';

    it('throws NotFoundException when no UserSet with that id exists', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue(null);

      await expect(service.update('user-1', id, { name: 'X' } as never)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.userSet.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the set belongs to a different user', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'someone-else' });

      await expect(service.update('user-1', id, { name: 'X' } as never)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.userSet.update).not.toHaveBeenCalled();
    });

    it('updates the name when the caller owns the set', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'user-1' });
      const updated = { id, userId: 'user-1', name: 'Renamed' };
      mockPrismaService.userSet.update.mockResolvedValue(updated);

      const result = await service.update('user-1', id, { name: 'Renamed' } as never);

      expect(mockPrismaService.userSet.update).toHaveBeenCalledWith({
        where: { id },
        data: { name: 'Renamed' },
      });
      expect(result).toBe(updated);
    });
  });

  describe('remove — ownership check and Ownership isolation (criteria #9, #10 from run_20260719_200109/prd.md)', () => {
    const id = '77777777-7777-7777-7777-777777777777';

    it('throws NotFoundException when no UserSet with that id exists', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue(null);

      await expect(service.remove('user-1', id)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.userSet.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the set belongs to a different user', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'someone-else' });

      await expect(service.remove('user-1', id)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.userSet.delete).not.toHaveBeenCalled();
    });

    it('deletes the UserSet row when the caller owns it, and never touches prisma.ownership', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'user-1' });

      await service.remove('user-1', id);

      expect(mockPrismaService.userSet.delete).toHaveBeenCalledWith({ where: { id } });
      expect(mockPrismaService.ownership.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.upsert).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('patchCoins — ownership check (criterion #1 from run_20260720_070901/prd.md)', () => {
    const id = '88888888-8888-8888-8888-888888888888';

    it('throws NotFoundException when no UserSet with that id exists, and never calls userSetCoin.*', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue(null);

      await expect(service.patchCoins('user-1', id, { add: [uuidA] })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.userSetCoin.createMany).not.toHaveBeenCalled();
      expect(mockPrismaService.userSetCoin.deleteMany).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the set belongs to a different user, and never calls userSetCoin.*', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'someone-else' });

      await expect(service.patchCoins('user-1', id, { add: [uuidA] })).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.userSetCoin.createMany).not.toHaveBeenCalled();
      expect(mockPrismaService.userSetCoin.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('patchCoins — adding coins (criteria #3, #4 from run_20260720_070901/prd.md)', () => {
    const id = '99999999-9999-9999-9999-999999999999';

    beforeEach(() => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'user-1' });
    });

    it('assigns position 1 to the first coin added to an empty set', async () => {
      mockPrismaService.userSetCoin.aggregate.mockResolvedValue({ _max: { position: null } });

      await service.patchCoins('user-1', id, { add: [uuidA] });

      const createManyArg = mockPrismaService.userSetCoin.createMany.mock.calls[0][0];
      expect(createManyArg.data).toEqual([{ userSetId: id, coinId: uuidA, position: 1 }]);
      expect(createManyArg.skipDuplicates).toBe(true);
    });

    it('assigns positions starting at max(position) + 1 for a non-empty set', async () => {
      mockPrismaService.userSetCoin.aggregate.mockResolvedValue({ _max: { position: 5 } });

      await service.patchCoins('user-1', id, { add: [uuidA, uuidB] });

      const createManyArg = mockPrismaService.userSetCoin.createMany.mock.calls[0][0];
      expect(createManyArg.data).toEqual([
        { userSetId: id, coinId: uuidA, position: 6 },
        { userSetId: id, coinId: uuidB, position: 7 },
      ]);
    });

    it('runs the max(position) read and the createMany inside one $transaction', async () => {
      mockPrismaService.userSetCoin.aggregate.mockResolvedValue({ _max: { position: null } });

      await service.patchCoins('user-1', id, { add: [uuidA] });

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.userSetCoin.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userSetId: id }, _max: { position: true } }),
      );
    });

    it('de-dupes the same coin ID appearing twice in one add array to a single createMany entry', async () => {
      mockPrismaService.userSetCoin.aggregate.mockResolvedValue({ _max: { position: null } });

      await service.patchCoins('user-1', id, { add: [uuidA, uuidA] });

      const createManyArg = mockPrismaService.userSetCoin.createMany.mock.calls[0][0];
      const coinIdsInserted = createManyArg.data.map((row: { coinId: string }) => row.coinId);
      expect(coinIdsInserted).toEqual([uuidA]);
    });

    it('uses skipDuplicates so a coin ID already in the set (per a prior separate call) is a no-op, not an error', async () => {
      mockPrismaService.userSetCoin.aggregate.mockResolvedValue({ _max: { position: 1 } });
      mockPrismaService.userSetCoin.createMany.mockResolvedValue({ count: 0 });

      await expect(service.patchCoins('user-1', id, { add: [uuidA] })).resolves.toBeDefined();

      const createManyArg = mockPrismaService.userSetCoin.createMany.mock.calls[0][0];
      expect(createManyArg.skipDuplicates).toBe(true);
    });

    it('does not call $transaction/aggregate/createMany when add is empty or absent', async () => {
      await service.patchCoins('user-1', id, {});

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockPrismaService.userSetCoin.aggregate).not.toHaveBeenCalled();
      expect(mockPrismaService.userSetCoin.createMany).not.toHaveBeenCalled();
    });
  });

  describe('patchCoins — removing coins, Ownership isolation (criterion #5 from run_20260720_070901/prd.md)', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    beforeEach(() => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'user-1' });
    });

    it('calls deleteMany scoped to userSetId and the given coin IDs', async () => {
      await service.patchCoins('user-1', id, { remove: [uuidA, uuidB] });

      expect(mockPrismaService.userSetCoin.deleteMany).toHaveBeenCalledWith({
        where: { userSetId: id, coinId: { in: [uuidA, uuidB] } },
      });
    });

    it('never reads or writes prisma.ownership when removing coins', async () => {
      await service.patchCoins('user-1', id, { remove: [uuidA] });

      expect(mockPrismaService.ownership.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.upsert).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.deleteMany).not.toHaveBeenCalled();
    });

    it('does not call deleteMany when remove is empty or absent', async () => {
      await service.patchCoins('user-1', id, {});

      expect(mockPrismaService.userSetCoin.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('patchCoins — add-then-remove-then-re-add (criterion #6 from run_20260720_070901/prd.md)', () => {
    const id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    beforeEach(() => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'user-1' });
    });

    it('re-adding a coin after removal reads a fresh max(position), not a stale one', async () => {
      // First call: add coin A to an empty set -> position 1.
      mockPrismaService.userSetCoin.aggregate.mockResolvedValueOnce({ _max: { position: null } });
      await service.patchCoins('user-1', id, { add: [uuidA] });
      expect(mockPrismaService.userSetCoin.createMany.mock.calls[0][0].data).toEqual([
        { userSetId: id, coinId: uuidA, position: 1 },
      ]);

      // Second call: remove coin A.
      await service.patchCoins('user-1', id, { remove: [uuidA] });
      expect(mockPrismaService.userSetCoin.deleteMany).toHaveBeenCalledWith({
        where: { userSetId: id, coinId: { in: [uuidA] } },
      });

      // Third call: re-add coin A — the set is conceptually empty again, so max(position)
      // is queried fresh (mocked here as if position 1 was never re-used/collided).
      mockPrismaService.userSetCoin.aggregate.mockResolvedValueOnce({ _max: { position: null } });
      await service.patchCoins('user-1', id, { add: [uuidA] });
      expect(mockPrismaService.userSetCoin.createMany.mock.calls[1][0].data).toEqual([
        { userSetId: id, coinId: uuidA, position: 1 },
      ]);
    });
  });

  describe('patchCoins — response shape (criterion #7 from run_20260720_070901/prd.md)', () => {
    const id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    it('returns the current UserSetCoin rows for the set, ordered by position', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'user-1' });
      const rows = [
        { id: 'usc-1', userSetId: id, coinId: uuidA, position: 1 },
        { id: 'usc-2', userSetId: id, coinId: uuidB, position: 2 },
      ];
      mockPrismaService.userSetCoin.findMany.mockResolvedValue(rows);

      const result = await service.patchCoins('user-1', id, {});

      expect(mockPrismaService.userSetCoin.findMany).toHaveBeenCalledWith({
        where: { userSetId: id },
        orderBy: { position: 'asc' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('findAllCanonical (criterion #8 from run_20260720_070901/prd.md; criterion #18 from run_20261013_062900/prd.md)', () => {
    it('maps each row to a flat coinCount taken from _count.coins and drops the _count key', async () => {
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([
        {
          id: 'cs-1',
          name: 'Lincoln Cents',
          description: null,
          source: 'admin',
          templateVersion: '1',
          _count: { coins: 12 },
        },
      ]);

      const result = await service.findAllCanonical();

      expect(result).toEqual([
        {
          id: 'cs-1',
          name: 'Lincoln Cents',
          description: null,
          source: 'admin',
          templateVersion: '1',
          coinCount: 12,
        },
      ]);
      expect(result[0]).not.toHaveProperty('_count');
    });

    it('gives every row its own count (two rows with different _count.coins)', async () => {
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([
        {
          id: 'cs-1',
          name: 'A',
          description: 'first',
          source: 'admin',
          templateVersion: '1',
          _count: { coins: 187 },
        },
        {
          id: 'cs-2',
          name: 'B',
          description: null,
          source: 'seed-template',
          templateVersion: '2',
          _count: { coins: 0 },
        },
      ]);

      const result = await service.findAllCanonical();

      expect(result.map((row) => row.coinCount)).toEqual([187, 0]);
      expect(result.map((row) => row.id)).toEqual(['cs-1', 'cs-2']);
      result.forEach((row) => expect(row).not.toHaveProperty('_count'));
    });

    it('asks Prisma for the coins count, ordered by name ascending', async () => {
      await service.findAllCanonical();

      expect(mockPrismaService.canonicalSet.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: { _count: { select: { coins: true } } },
      });
    });

    it('returns an empty array when there are no canonical sets', async () => {
      mockPrismaService.canonicalSet.findMany.mockResolvedValue([]);

      await expect(service.findAllCanonical()).resolves.toEqual([]);
    });
  });

  describe('findCanonicalById (criterion #9 from run_20260720_070901/prd.md)', () => {
    it('throws NotFoundException when no CanonicalSet with that id exists', async () => {
      mockPrismaService.canonicalSet.findUnique.mockResolvedValue(null);

      await expect(service.findCanonicalById(uuidC)).rejects.toThrow(NotFoundException);
    });

    it('fetches with the coin relation joined and ordered by position ascending', async () => {
      const detail = {
        id: uuidC,
        name: 'Lincoln Cents',
        description: null,
        source: 'admin',
        templateVersion: '1',
        coins: [{ id: 'csc-1', position: 1, coin: { id: 'coin-a' } }],
      };
      mockPrismaService.canonicalSet.findUnique.mockResolvedValue(detail);

      const result = await service.findCanonicalById(uuidC);

      expect(mockPrismaService.canonicalSet.findUnique).toHaveBeenCalledWith({
        where: { id: uuidC },
        include: { coins: { orderBy: { position: 'asc' }, include: { coin: true } } },
      });
      expect(result).toBe(detail);
    });
  });

  describe('findAllPublic — pagination (criteria #10, #16 from run_20260720_070901/prd.md)', () => {
    it('defaults to page 1 / limit 20 when the DTO is unmodified', async () => {
      const result = await service.findAllPublic(makePublicQuery());

      const call = mockPrismaService.userSet.findMany.mock.calls[0][0];
      expect(call.skip).toBe(0);
      expect(call.take).toBe(20);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('computes skip from page and limit', async () => {
      await service.findAllPublic(makePublicQuery({ page: 3, limit: 10 }));

      const call = mockPrismaService.userSet.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(10);
    });

    it('clamps a limit above 100 down to 100, not honored literally', async () => {
      const result = await service.findAllPublic(makePublicQuery({ limit: 1000 }));

      const call = mockPrismaService.userSet.findMany.mock.calls[0][0];
      expect(call.take).toBe(100);
      expect(result.limit).toBe(100);
    });

    it('applies no where filter — every UserSet row across every user (criterion #12)', async () => {
      await service.findAllPublic(makePublicQuery());

      const call = mockPrismaService.userSet.findMany.mock.calls[0][0];
      expect(call.where).toBeUndefined();
    });

    it('returns total from the separate count query, not items.length', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([
        { id: 'a', _count: { coins: 1 } },
        { id: 'b', _count: { coins: 2 } },
      ]);
      mockPrismaService.userSet.count.mockResolvedValue(50);

      const result = await service.findAllPublic(makePublicQuery());

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(50);
    });

    it('returns the { items, page, limit, total } shape', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([{ id: 'x', _count: { coins: 3 } }]);
      mockPrismaService.userSet.count.mockResolvedValue(1);

      const result = await service.findAllPublic(makePublicQuery({ page: 2, limit: 5 }));

      expect(result).toEqual({
        items: [{ id: 'x', coinCount: 3 }],
        page: 2,
        limit: 5,
        total: 1,
      });
    });
  });

  describe('findAllPublic — coinCount (criterion #19 from run_20261013_062900/prd.md)', () => {
    it('asks Prisma for the coins count alongside skip, take and createdAt ordering', async () => {
      await service.findAllPublic(makePublicQuery({ page: 2, limit: 10 }));

      expect(mockPrismaService.userSet.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { coins: true } } },
      });
    });

    it('maps each item to a flat coinCount from its own _count.coins and drops the _count key', async () => {
      mockPrismaService.userSet.findMany.mockResolvedValue([
        { id: 'u1', userId: 'user-2', name: "Bob's Set", _count: { coins: 42 } },
        { id: 'u2', userId: 'user-3', name: 'Empty Set', _count: { coins: 0 } },
      ]);
      mockPrismaService.userSet.count.mockResolvedValue(2);

      const result = await service.findAllPublic(makePublicQuery());

      expect(result.items).toEqual([
        { id: 'u1', userId: 'user-2', name: "Bob's Set", coinCount: 42 },
        { id: 'u2', userId: 'user-3', name: 'Empty Set', coinCount: 0 },
      ]);
      result.items.forEach((item) => expect(item).not.toHaveProperty('_count'));
    });
  });

  describe('findPublicById (criteria #11, #12 from run_20260720_070901/prd.md)', () => {
    it('throws NotFoundException when no UserSet with that id exists', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue(null);

      await expect(service.findPublicById(uuidC)).rejects.toThrow(NotFoundException);
    });

    it('fetches with the coin relation joined and ordered by position ascending, for any set (no owner filter)', async () => {
      const detail = {
        id: uuidC,
        userId: 'someone-else',
        name: 'A Public Set',
        clonedFromCanonicalId: null,
        clonedFromUserSetId: null,
        coins: [{ id: 'usc-1', position: 1, coin: { id: 'coin-a' } }],
      };
      mockPrismaService.userSet.findUnique.mockResolvedValue(detail);

      const result = await service.findPublicById(uuidC);

      expect(mockPrismaService.userSet.findUnique).toHaveBeenCalledWith({
        where: { id: uuidC },
        include: { coins: { orderBy: { position: 'asc' }, include: { coin: true } } },
      });
      expect(result).toBe(detail);
    });
  });

  describe('getGaps — unknown set (criterion #9 from run_20260720_142942/prd.md)', () => {
    it('throws NotFoundException when no UserSet with that id exists', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue(null);

      await expect(service.getGaps('user-1', uuidC)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getGaps — not owner-restricted (criterion #9 from run_20260720_142942/prd.md)', () => {
    it('never calls getOwnedSetOrThrow-style ownership checks — no ForbiddenException even for a set owned by someone else', async () => {
      const detail = {
        id: uuidC,
        userId: 'someone-else',
        coins: [{ id: 'usc-1', position: 1, coin: { id: 'coin-a', ownerships: [] } }],
      };
      mockPrismaService.userSet.findUnique.mockResolvedValue(detail);

      await expect(service.getGaps('user-1', uuidC)).resolves.toBeDefined();
    });

    it('fetches with the coins relation joined, ordered by position, and ownerships filtered to the caller', async () => {
      const detail = { id: uuidC, userId: 'someone-else', coins: [] };
      mockPrismaService.userSet.findUnique.mockResolvedValue(detail);

      await service.getGaps('user-1', uuidC);

      expect(mockPrismaService.userSet.findUnique).toHaveBeenCalledWith({
        where: { id: uuidC },
        include: {
          coins: {
            orderBy: { position: 'asc' },
            include: { coin: { include: { ownerships: { where: { userId: 'user-1' } } } } },
          },
        },
      });
    });

    it('is a single query — no per-slot/N+1 lookups against userSetCoin or ownership', async () => {
      const detail = {
        id: uuidC,
        coins: [
          { id: 'usc-1', position: 1, coin: { id: 'coin-a', ownerships: [{ userId: 'user-1' }] } },
          { id: 'usc-2', position: 2, coin: { id: 'coin-b', ownerships: [] } },
          { id: 'usc-3', position: 3, coin: { id: 'coin-c', ownerships: [] } },
        ],
      };
      mockPrismaService.userSet.findUnique.mockResolvedValue(detail);

      await service.getGaps('user-1', uuidC);

      // Exactly one round trip for the whole set, regardless of how many slots it has —
      // a per-slot implementation would call one of these once per coin (3 times here)
      // instead of the nested `include` doing it in the single findUnique call above.
      expect(mockPrismaService.userSet.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.userSetCoin.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.upsert).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('getGaps — computation (criteria #10, #11 from run_20260720_142942/prd.md)', () => {
    it('marks a slot owned when the caller has a matching ownership row, not owned when the array is empty', async () => {
      const detail = {
        id: uuidC,
        coins: [
          { id: 'usc-1', position: 1, coin: { id: 'coin-a', ownerships: [{ userId: 'user-1', coinId: 'coin-a' }] } },
          { id: 'usc-2', position: 2, coin: { id: 'coin-b', ownerships: [] } },
        ],
      };
      mockPrismaService.userSet.findUnique.mockResolvedValue(detail);

      const result = await service.getGaps('user-1', uuidC);

      expect(result.slots).toEqual([
        { id: 'usc-1', position: 1, coin: { id: 'coin-a', ownerships: [{ userId: 'user-1', coinId: 'coin-a' }] }, owned: true },
        { id: 'usc-2', position: 2, coin: { id: 'coin-b', ownerships: [] }, owned: false },
      ]);
    });

    it('computes ownedCount, totalCount, and completionPercent rounded to the nearest integer', async () => {
      const detail = {
        id: uuidC,
        coins: [
          { id: 'usc-1', position: 1, coin: { id: 'coin-a', ownerships: [{ userId: 'user-1' }] } },
          { id: 'usc-2', position: 2, coin: { id: 'coin-b', ownerships: [] } },
          { id: 'usc-3', position: 3, coin: { id: 'coin-c', ownerships: [] } },
        ],
      };
      mockPrismaService.userSet.findUnique.mockResolvedValue(detail);

      const result = await service.getGaps('user-1', uuidC);

      expect(result.ownedCount).toBe(1);
      expect(result.totalCount).toBe(3);
      // 1/3 = 33.33...% -> rounds to 33.
      expect(result.completionPercent).toBe(33);
      expect(result.setId).toBe(uuidC);
    });

    it('returns completionPercent: 0 for a set with zero coins, without dividing by zero', async () => {
      const detail = { id: uuidC, coins: [] };
      mockPrismaService.userSet.findUnique.mockResolvedValue(detail);

      const result = await service.getGaps('user-1', uuidC);

      expect(result.totalCount).toBe(0);
      expect(result.ownedCount).toBe(0);
      expect(result.completionPercent).toBe(0);
      expect(result.slots).toEqual([]);
    });

    it('returns completionPercent: 100 when every coin is owned by the caller', async () => {
      const detail = {
        id: uuidC,
        coins: [
          { id: 'usc-1', position: 1, coin: { id: 'coin-a', ownerships: [{ userId: 'user-1' }] } },
          { id: 'usc-2', position: 2, coin: { id: 'coin-b', ownerships: [{ userId: 'user-1' }] } },
        ],
      };
      mockPrismaService.userSet.findUnique.mockResolvedValue(detail);

      const result = await service.getGaps('user-1', uuidC);

      expect(result.completionPercent).toBe(100);
    });

    it("returns completionPercent: 0 when the caller owns none of the set's coins", async () => {
      const detail = {
        id: uuidC,
        coins: [
          { id: 'usc-1', position: 1, coin: { id: 'coin-a', ownerships: [] } },
          { id: 'usc-2', position: 2, coin: { id: 'coin-b', ownerships: [] } },
        ],
      };
      mockPrismaService.userSet.findUnique.mockResolvedValue(detail);

      const result = await service.getGaps('user-1', uuidC);

      expect(result.ownedCount).toBe(0);
      expect(result.totalCount).toBe(2);
      expect(result.completionPercent).toBe(0);
    });
  });
});
