/**
 * Tests for: GET /sets/canonical/:id/gaps (unit): buildGapView, SetsService.getCanonicalGaps,
 *            SetsController.getCanonicalGaps
 * Contract source: runs/run_20261108_173105/plan.md § Interface Contract
 * Covers criteria: #2, #4, #5, #6, #7, #8, #9, #10, #11 (from runs/run_20261108_173105/prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type { CatalogCoin, CoinGrade } from '@coin-collector/shared';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CATALOG_COIN_SELECT } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { SetsController } from './sets.controller';
import { buildGapView, SetsService } from './sets.service';
import type { GapSlotSource } from './sets.service';

const SET_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function coin(id: string): CatalogCoin {
  return { id, name: `Coin ${id}`, year: 1950 } as unknown as CatalogCoin;
}

function source(id: string, position: number, ownership: { grade: CoinGrade | null } | null): GapSlotSource {
  return { id: `slot-${id}`, position, coin: coin(`coin-${id}`), ownership };
}

describe('buildGapView', () => {
  it('counts 1 of 3 as 33 percent and 2 of 3 as 67 percent', () => {
    const one = buildGapView(SET_ID, null, [
      source('a', 1, { grade: null }),
      source('b', 2, null),
      source('c', 3, null),
    ]);
    expect(one).toMatchObject({ ownedCount: 1, totalCount: 3, completionPercent: 33 });

    const two = buildGapView(SET_ID, null, [
      source('a', 1, { grade: null }),
      source('b', 2, { grade: null }),
      source('c', 3, null),
    ]);
    expect(two).toMatchObject({ ownedCount: 2, totalCount: 3, completionPercent: 67 });
  });

  it('returns 0 percent and no slots for zero coins', () => {
    const view = buildGapView(SET_ID, null, []);
    expect(view).toMatchObject({ setId: SET_ID, ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] });
  });

  it('returns 100 percent when everything is owned', () => {
    const view = buildGapView(SET_ID, null, [source('a', 1, { grade: null }), source('b', 2, { grade: 'XF' })]);
    expect(view).toMatchObject({ ownedCount: 2, totalCount: 2, completionPercent: 100 });
  });

  it('keeps the order of the sources and passes id, position and coin through unchanged', () => {
    const sources = [source('a', 1, null), source('b', 2, null), source('c', 3, null)];
    const view = buildGapView(SET_ID, null, sources);
    expect(view.slots.map((s) => s.id)).toEqual(['slot-a', 'slot-b', 'slot-c']);
    expect(view.slots.map((s) => s.position)).toEqual([1, 2, 3]);
    expect(view.slots[1].coin).toBe(sources[1].coin);
  });

  it('passes the grade through for owned slots and uses null otherwise', () => {
    const view = buildGapView(SET_ID, null, [
      source('a', 1, { grade: 'XF' }),
      source('b', 2, { grade: null }),
      source('c', 3, null),
      source('d', 4, { grade: 'VF' }),
    ]);
    expect(view.slots.map((s) => [s.owned, s.grade])).toEqual([
      [true, 'XF'],
      [true, null],
      [false, null],
      [true, 'VF'],
    ]);
  });

  it('treats an ownership row without a grade key as grade null', () => {
    const sources = [
      { id: 'slot-a', position: 1, coin: coin('a'), ownership: {} },
    ] as unknown as GapSlotSource[];
    const view = buildGapView(SET_ID, null, sources);
    expect(view.slots[0].owned).toBe(true);
    expect(view.slots[0].grade).toBeNull();
  });

  it('grades never change counts or percent', () => {
    const graded = buildGapView(SET_ID, null, [
      source('a', 1, { grade: 'XF' }),
      source('b', 2, { grade: 'VF' }),
      source('c', 3, null),
    ]);
    const ungraded = buildGapView(SET_ID, null, [
      source('a', 1, { grade: null }),
      source('b', 2, { grade: null }),
      source('c', 3, null),
    ]);
    expect(graded.ownedCount).toBe(ungraded.ownedCount);
    expect(graded.completionPercent).toBe(ungraded.completionPercent);
    expect(graded.ownedCount).toBe(2);
  });

  it('with minGrade null has no needsUpgrade on slots and no upgradeCount on the response', () => {
    const view = buildGapView(SET_ID, null, [source('a', 1, { grade: 'XF' }), source('b', 2, null)]);
    expect(view.minGrade).toBeNull();
    expect(view).not.toHaveProperty('upgradeCount');
    for (const slot of view.slots) {
      expect(slot).not.toHaveProperty('needsUpgrade');
    }
  });

  it('with a minGrade includes upgradeCount and needsUpgrade (shared rule still holds for getGaps)', () => {
    const view = buildGapView(SET_ID, 'VF', [source('a', 1, { grade: 'XF' }), source('b', 2, null)]);
    expect(view.minGrade).toBe('VF');
    expect(view).toHaveProperty('upgradeCount');
    for (const slot of view.slots) {
      expect(slot).toHaveProperty('needsUpgrade');
    }
  });
});

describe('SetsService.getCanonicalGaps', () => {
  let service: SetsService;
  let mockPrismaService: {
    canonicalSet: { findUnique: jest.Mock };
    canonicalSetCoin: { findMany: jest.Mock };
    ownership: { findMany: jest.Mock };
  };

  const caller = 'user-1';

  const row = (
    id: string,
    position: number,
    ownerships: { grade: CoinGrade | null }[],
  ): Record<string, unknown> => ({
    id,
    position,
    coin: { id: `coin-${id}`, name: `Coin ${id}`, ownerships },
  });

  beforeEach(async () => {
    mockPrismaService = {
      canonicalSet: { findUnique: jest.fn() },
      canonicalSetCoin: { findMany: jest.fn() },
      ownership: { findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [SetsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();
    service = module.get(SetsService);
  });

  it('issues exactly one canonicalSet.findUnique with the id and ordered, caller-scoped select', async () => {
    mockPrismaService.canonicalSet.findUnique.mockResolvedValue({ id: SET_ID, coins: [] });

    await service.getCanonicalGaps(caller, SET_ID);

    expect(mockPrismaService.canonicalSet.findUnique).toHaveBeenCalledTimes(1);
    const args = mockPrismaService.canonicalSet.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: SET_ID });
    expect(args.select.coins.orderBy).toEqual({ position: 'asc' });
    expect(args.select.coins.select.id).toBe(true);
    expect(args.select.coins.select.position).toBe(true);
    expect(args.select.coins.select.coin.select).toEqual({
      ...CATALOG_COIN_SELECT,
      ownerships: { where: { userId: caller }, select: { grade: true } },
    });
    expect(mockPrismaService.canonicalSetCoin.findMany).not.toHaveBeenCalled();
    expect(mockPrismaService.ownership.findMany).not.toHaveBeenCalled();
  });

  it('filters ownerships by the caller only (two callers give two different filters)', async () => {
    mockPrismaService.canonicalSet.findUnique.mockResolvedValue({ id: SET_ID, coins: [] });

    await service.getCanonicalGaps('user-1', SET_ID);
    await service.getCanonicalGaps('user-2', SET_ID);

    const first = mockPrismaService.canonicalSet.findUnique.mock.calls[0][0].select.coins.select.coin.select;
    const second = mockPrismaService.canonicalSet.findUnique.mock.calls[1][0].select.coins.select.coin.select;
    expect(first.ownerships.where).toEqual({ userId: 'user-1' });
    expect(second.ownerships.where).toEqual({ userId: 'user-2' });
  });

  it('maps slots from the CanonicalSetCoin rows with owned and grade from the caller ownership', async () => {
    mockPrismaService.canonicalSet.findUnique.mockResolvedValue({
      id: SET_ID,
      coins: [row('csc-1', 1, [{ grade: 'XF' }]), row('csc-2', 2, []), row('csc-3', 5, [{ grade: null }])],
    });

    const view = await service.getCanonicalGaps(caller, SET_ID);

    expect(view).toMatchObject({
      setId: SET_ID,
      minGrade: null,
      ownedCount: 2,
      totalCount: 3,
      completionPercent: 67,
    });
    expect(view.slots.map((s) => [s.id, s.position, s.owned, s.grade])).toEqual([
      ['csc-1', 1, true, 'XF'],
      ['csc-2', 2, false, null],
      ['csc-3', 5, true, null],
    ]);
  });

  it('returns a different result for a different ownership state (not hard-coded)', async () => {
    mockPrismaService.canonicalSet.findUnique.mockResolvedValue({
      id: SET_ID,
      coins: [row('csc-1', 1, []), row('csc-2', 2, [])],
    });

    const view = await service.getCanonicalGaps(caller, SET_ID);

    expect(view).toMatchObject({ ownedCount: 0, totalCount: 2, completionPercent: 0 });
  });

  it('has no upgradeCount or needsUpgrade and strips ownerships from the coin', async () => {
    mockPrismaService.canonicalSet.findUnique.mockResolvedValue({
      id: SET_ID,
      coins: [row('csc-1', 1, [{ grade: 'XF' }])],
    });

    const view = await service.getCanonicalGaps(caller, SET_ID);

    expect(view).not.toHaveProperty('upgradeCount');
    expect(view.slots[0]).not.toHaveProperty('needsUpgrade');
    expect(view.slots[0].coin).not.toHaveProperty('ownerships');
    expect(view.slots[0].coin).toMatchObject({ id: 'coin-csc-1', name: 'Coin csc-1' });
  });

  it('handles a checklist with no coins', async () => {
    mockPrismaService.canonicalSet.findUnique.mockResolvedValue({ id: SET_ID, coins: [] });

    const view = await service.getCanonicalGaps(caller, SET_ID);

    expect(view).toMatchObject({ totalCount: 0, ownedCount: 0, completionPercent: 0, slots: [] });
  });

  it('throws NotFoundException when the checklist does not exist', async () => {
    mockPrismaService.canonicalSet.findUnique.mockResolvedValue(null);

    await expect(service.getCanonicalGaps(caller, SET_ID)).rejects.toThrow(NotFoundException);
  });
});

describe('SetsController.getCanonicalGaps', () => {
  let controller: SetsController;
  let mockSetsService: { getCanonicalGaps: jest.Mock };
  const user: AuthenticatedUser = { userId: 'user-1', email: 'a@example.com' };

  beforeEach(async () => {
    mockSetsService = { getCanonicalGaps: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SetsController],
      providers: [{ provide: SetsService, useValue: mockSetsService }],
    }).compile();
    controller = module.get(SetsController);
  });

  it('is not marked @Public()', () => {
    const reflector = new Reflector();
    expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.getCanonicalGaps)).toBeFalsy();
  });

  it('delegates (user.userId, id) and returns the service result unchanged', async () => {
    const result = { setId: SET_ID, slots: [] };
    mockSetsService.getCanonicalGaps.mockResolvedValue(result);

    const out = await controller.getCanonicalGaps(user, SET_ID);

    expect(mockSetsService.getCanonicalGaps).toHaveBeenCalledWith('user-1', SET_ID);
    expect(out).toBe(result);
  });

  it('passes through a different caller id', async () => {
    mockSetsService.getCanonicalGaps.mockResolvedValue({});

    await controller.getCanonicalGaps({ userId: 'user-9', email: 'b@example.com' }, SET_ID);

    expect(mockSetsService.getCanonicalGaps).toHaveBeenCalledWith('user-9', SET_ID);
  });
});
