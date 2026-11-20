/**
 * Tests for: GET /sets/wants (unit): buildWantList, SetsService.getWantList, SetsController.getWantList,
 *            WantListResponse types
 * Contract source: runs/run_20261120_211112/plan.md § Interface Contract
 * Covers criteria: #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12 (from runs/run_20261120_211112/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * No real database or network: PrismaService is a jest mock, SetsService is mocked for the controller tests.
 */

import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type { CatalogCoin, CoinGrade, UpgradeWant, WantCoin, WantListResponse } from '@coin-collector/shared';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CATALOG_COIN_SELECT } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { SetsController } from './sets.controller';
import { SetsService } from './sets.service';
import { buildWantList } from './want-list';
import type { WantListOwnershipSource, WantListSlotSource } from './want-list';

interface CoinParts {
  country?: string;
  denomination?: string;
  year?: number;
  mintMark?: string;
  variety?: string;
}

function coin(id: string, parts: CoinParts = {}): CatalogCoin {
  return {
    id,
    country: 'Testland',
    denomination: '1 Cent',
    year: 1950,
    mintMark: '',
    variety: '',
    name: `Coin ${id}`,
    ...parts,
  } as unknown as CatalogCoin;
}

function slot(c: CatalogCoin, setId: string, setName: string, minGrade: CoinGrade | null = null): WantListSlotSource {
  return { coin: c, userSet: { id: setId, name: setName, minGrade } };
}

function own(coinId: string, grade: CoinGrade | null = null): WantListOwnershipSource {
  return { coinId, grade };
}

describe('buildWantList', () => {
  it('returns setCount and empty lists for no slots', () => {
    expect(buildWantList(0, [], [])).toEqual({ setCount: 0, missing: [], upgrades: [] });
    expect(buildWantList(4, [], [])).toEqual({ setCount: 4, missing: [], upgrades: [] });
  });

  it('lists a coin in two sets once in missing, with both sets ordered by name', () => {
    const c = coin('c1');
    const result = buildWantList(
      2,
      [slot(c, 'set-z', 'Zebra set'), slot(c, 'set-a', 'Alpha set')],
      [],
    );
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].coin.id).toBe('c1');
    expect(result.missing[0].sets).toEqual([
      { id: 'set-a', name: 'Alpha set' },
      { id: 'set-z', name: 'Zebra set' },
    ]);
    expect(result.upgrades).toEqual([]);
  });

  it('orders sets with the same name by id', () => {
    const c = coin('c1');
    const result = buildWantList(2, [slot(c, 'set-b', 'Same'), slot(c, 'set-a', 'Same')], []);
    expect(result.missing[0].sets.map((s) => s.id)).toEqual(['set-a', 'set-b']);
  });

  it('keeps only id and name on set references (no minGrade) and no extra keys on entries', () => {
    const result = buildWantList(1, [slot(coin('c1'), 'set-a', 'Alpha', 'VF')], []);
    expect(Object.keys(result.missing[0]).sort()).toEqual(['coin', 'sets']);
    expect(result.missing[0].sets[0]).toEqual({ id: 'set-a', name: 'Alpha' });
  });

  it('does not mutate its inputs', () => {
    const slots = [slot(coin('b'), 's2', 'B set', 'VF'), slot(coin('a'), 's1', 'A set')];
    const ownerships = [own('b', 'F')];
    const slotsCopy = JSON.parse(JSON.stringify(slots));
    const ownCopy = JSON.parse(JSON.stringify(ownerships));
    buildWantList(2, slots, ownerships);
    expect(slots).toEqual(slotsCopy);
    expect(ownerships).toEqual(ownCopy);
  });

  describe('upgrades', () => {
    it('owned below the minimum is an upgrade with grade, targetGrade and the failing set', () => {
      const result = buildWantList(1, [slot(coin('c1'), 's1', 'Set one', 'XF')], [own('c1', 'VF')]);
      expect(result.missing).toEqual([]);
      expect(result.upgrades).toHaveLength(1);
      expect(result.upgrades[0]).toMatchObject({
        grade: 'VF',
        targetGrade: 'XF',
        sets: [{ id: 's1', name: 'Set one' }],
      });
    });

    it('owned at or above the minimum is in neither list', () => {
      const atMin = buildWantList(1, [slot(coin('c1'), 's1', 'S', 'VF')], [own('c1', 'VF')]);
      expect(atMin.missing).toEqual([]);
      expect(atMin.upgrades).toEqual([]);
      const above = buildWantList(1, [slot(coin('c1'), 's1', 'S', 'VF')], [own('c1', 'AU')]);
      expect(above.upgrades).toEqual([]);
    });

    it('targetGrade is the highest failed minimum and sets lists only failing sets', () => {
      const c = coin('c1');
      const result = buildWantList(
        3,
        [slot(c, 's-vf', 'VF set', 'VF'), slot(c, 's-au', 'AU set', 'AU'), slot(c, 's-f', 'F set', 'F')],
        [own('c1', 'XF')],
      );
      expect(result.upgrades).toHaveLength(1);
      expect(result.upgrades[0].grade).toBe('XF');
      expect(result.upgrades[0].targetGrade).toBe('AU');
      expect(result.upgrades[0].sets).toEqual([{ id: 's-au', name: 'AU set' }]);
    });

    it('a different set of minimums gives a different targetGrade', () => {
      const c = coin('c1');
      const low = buildWantList(2, [slot(c, 'a', 'A', 'VF'), slot(c, 'b', 'B', 'XF')], [own('c1', 'F')]);
      expect(low.upgrades[0].targetGrade).toBe('XF');
      expect(low.upgrades[0].sets.map((s) => s.id)).toEqual(['a', 'b']);
      const high = buildWantList(2, [slot(c, 'a', 'A', 'VF'), slot(c, 'b', 'B', 'UNC')], [own('c1', 'F')]);
      expect(high.upgrades[0].targetGrade).toBe('UNC');
    });

    it('a set without a minimum is not listed for an upgrade', () => {
      const c = coin('c1');
      const result = buildWantList(2, [slot(c, 's-vf', 'VF set', 'VF'), slot(c, 's-none', 'No min', null)], [own('c1', 'F')]);
      expect(result.upgrades[0].targetGrade).toBe('VF');
      expect(result.upgrades[0].sets).toEqual([{ id: 's-vf', name: 'VF set' }]);
    });

    it('an ungraded owned coin is an upgrade with grade null where sets have minimums', () => {
      const c = coin('c1');
      const result = buildWantList(2, [slot(c, 's-f', 'F set', 'F'), slot(c, 's-xf', 'XF set', 'XF')], [own('c1', null)]);
      expect(result.upgrades).toHaveLength(1);
      expect(result.upgrades[0].grade).toBeNull();
      expect(result.upgrades[0].targetGrade).toBe('XF');
      expect(result.upgrades[0].sets).toHaveLength(2);
    });

    it('an ungraded owned coin whose sets have no minimum is in neither list', () => {
      const result = buildWantList(2, [slot(coin('c1'), 's1', 'One'), slot(coin('c1'), 's2', 'Two')], [own('c1', null)]);
      expect(result.missing).toEqual([]);
      expect(result.upgrades).toEqual([]);
    });

    it('an ungraded owned coin is skipped when only a set with no minimum contains it, but listed once another has one', () => {
      const c = coin('c1');
      const without = buildWantList(1, [slot(c, 's1', 'One', null)], [own('c1', null)]);
      expect(without.upgrades).toEqual([]);
      const withMin = buildWantList(2, [slot(c, 's1', 'One', null), slot(c, 's2', 'Two', 'G')], [own('c1', null)]);
      expect(withMin.upgrades).toHaveLength(1);
      expect(withMin.upgrades[0].sets).toEqual([{ id: 's2', name: 'Two' }]);
    });
  });

  it('never puts a coin in both lists', () => {
    const slots = [
      slot(coin('missing'), 's1', 'One', 'VF'),
      slot(coin('up'), 's1', 'One', 'VF'),
      slot(coin('up'), 's2', 'Two'),
      slot(coin('fine'), 's1', 'One', 'VF'),
    ];
    const result = buildWantList(2, slots, [own('up', 'F'), own('fine', 'XF')]);
    expect(result.missing.map((m) => m.coin.id)).toEqual(['missing']);
    expect(result.upgrades.map((u) => u.coin.id)).toEqual(['up']);
    const missingIds = new Set(result.missing.map((m) => m.coin.id));
    for (const u of result.upgrades) expect(missingIds.has(u.coin.id)).toBe(false);
  });

  describe('ordering', () => {
    const ids = (list: WantCoin[]) => list.map((m) => m.coin.id);

    it('orders by country', () => {
      const result = buildWantList(
        1,
        [
          slot(coin('us', { country: 'United States' }), 's', 'S'),
          slot(coin('ua', { country: 'Ukraine' }), 's', 'S'),
        ],
        [],
      );
      expect(ids(result.missing)).toEqual(['ua', 'us']);
    });

    it('orders denominations numerically (2 before 10)', () => {
      const result = buildWantList(
        1,
        [
          slot(coin('ten', { denomination: '10 Kopiyok' }), 's', 'S'),
          slot(coin('two', { denomination: '2 Kopiyky' }), 's', 'S'),
        ],
        [],
      );
      expect(ids(result.missing)).toEqual(['two', 'ten']);
    });

    it('orders by year ascending, then mint mark, then variety, then id', () => {
      const result = buildWantList(
        1,
        [
          slot(coin('y1952', { year: 1952 }), 's', 'S'),
          slot(coin('y1951-s', { year: 1951, mintMark: 'S' }), 's', 'S'),
          slot(coin('y1951-d', { year: 1951, mintMark: 'D' }), 's', 'S'),
          slot(coin('v-b', { year: 1949, variety: 'B' }), 's', 'S'),
          slot(coin('v-a', { year: 1949, variety: 'A' }), 's', 'S'),
          slot(coin('t-2', { year: 1948 }), 's', 'S'),
          slot(coin('t-1', { year: 1948 }), 's', 'S'),
        ],
        [],
      );
      expect(ids(result.missing)).toEqual(['t-1', 't-2', 'v-a', 'v-b', 'y1951-d', 'y1951-s', 'y1952']);
    });

    it('country takes precedence over denomination and year', () => {
      const result = buildWantList(
        1,
        [
          slot(coin('b', { country: 'Bravo', denomination: '1 Cent', year: 1900 }), 's', 'S'),
          slot(coin('a', { country: 'Alpha', denomination: '50 Cent', year: 2000 }), 's', 'S'),
        ],
        [],
      );
      expect(ids(result.missing)).toEqual(['a', 'b']);
    });

    it('applies the same order to upgrades', () => {
      const result = buildWantList(
        1,
        [
          slot(coin('late', { year: 1960 }), 's', 'S', 'XF'),
          slot(coin('early', { year: 1930 }), 's', 'S', 'XF'),
        ],
        [own('late', 'F'), own('early', 'F')],
      );
      expect(result.upgrades.map((u) => u.coin.id)).toEqual(['early', 'late']);
    });
  });

  it('passes setCount through unchanged, independent of slots', () => {
    expect(buildWantList(7, [slot(coin('c1'), 's1', 'S')], []).setCount).toBe(7);
    expect(buildWantList(2, [slot(coin('c1'), 's1', 'S')], []).setCount).toBe(2);
  });
});

describe('SetsService.getWantList', () => {
  let service: SetsService;
  let mockPrismaService: {
    userSet: { count: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock };
    userSetCoin: { findMany: jest.Mock };
    ownership: { findMany: jest.Mock };
    coin: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const caller = 'user-1';

  const totalCalls = (): number =>
    mockPrismaService.userSet.count.mock.calls.length +
    mockPrismaService.userSet.findMany.mock.calls.length +
    mockPrismaService.userSet.findFirst.mock.calls.length +
    mockPrismaService.userSet.findUnique.mock.calls.length +
    mockPrismaService.userSetCoin.findMany.mock.calls.length +
    mockPrismaService.ownership.findMany.mock.calls.length +
    mockPrismaService.coin.findMany.mock.calls.length;

  beforeEach(async () => {
    mockPrismaService = {
      userSet: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
      userSetCoin: { findMany: jest.fn() },
      ownership: { findMany: jest.fn() },
      coin: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [SetsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();
    service = module.get(SetsService);
  });

  it('scopes all three queries to the caller and uses the documented selects', async () => {
    mockPrismaService.userSet.count.mockResolvedValue(1);
    mockPrismaService.userSetCoin.findMany.mockResolvedValue([]);
    mockPrismaService.ownership.findMany.mockResolvedValue([]);

    await service.getWantList(caller);

    expect(mockPrismaService.userSet.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: caller } }),
    );

    expect(mockPrismaService.userSetCoin.findMany).toHaveBeenCalledTimes(1);
    const slotArgs = mockPrismaService.userSetCoin.findMany.mock.calls[0][0];
    expect(slotArgs).toEqual(expect.objectContaining({ where: { userSet: { userId: caller } } }));
    expect(slotArgs.select.coin.select).toEqual(CATALOG_COIN_SELECT);
    expect(slotArgs.select.userSet.select).toEqual({ id: true, name: true, minGrade: true });
    expect(slotArgs.select.coin.select).not.toHaveProperty('submittedByUserId');

    expect(mockPrismaService.ownership.findMany).toHaveBeenCalledTimes(1);
    const ownArgs = mockPrismaService.ownership.findMany.mock.calls[0][0];
    expect(ownArgs.where.userId).toBe(caller);
    expect(ownArgs.select).toEqual({ coinId: true, grade: true });
  });

  it('uses the same number of queries (at most 3) for one set, three sets and an empty account', async () => {
    const counts: number[] = [];

    const scenarios: { setCount: number; slots: WantListSlotSource[] }[] = [
      { setCount: 1, slots: [slot(coin('c1'), 's1', 'One')] },
      {
        setCount: 3,
        slots: [
          slot(coin('c1'), 's1', 'One'),
          slot(coin('c2'), 's2', 'Two'),
          slot(coin('c1'), 's3', 'Three'),
          slot(coin('c3'), 's3', 'Three'),
        ],
      },
      { setCount: 0, slots: [] },
    ];

    for (const scenario of scenarios) {
      jest.clearAllMocks();
      mockPrismaService.userSet.count.mockResolvedValue(scenario.setCount);
      mockPrismaService.userSetCoin.findMany.mockResolvedValue(scenario.slots);
      mockPrismaService.ownership.findMany.mockResolvedValue([]);
      await service.getWantList(caller);
      counts.push(totalCalls());
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    }

    expect(counts).toEqual([3, 3, 3]);
    for (const n of counts) expect(n).toBeLessThanOrEqual(3);
  });

  it('builds the response from the mocked rows (setCount from userSet.count, dedupe, upgrade)', async () => {
    mockPrismaService.userSet.count.mockResolvedValue(3);
    mockPrismaService.userSetCoin.findMany.mockResolvedValue([
      slot(coin('shared'), 's1', 'Beta'),
      slot(coin('shared'), 's2', 'Alpha'),
      slot(coin('upg'), 's1', 'Beta', 'XF'),
    ]);
    mockPrismaService.ownership.findMany.mockResolvedValue([own('upg', 'VF')]);

    const result = await service.getWantList(caller);

    expect(result.setCount).toBe(3);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].sets.map((s) => s.name)).toEqual(['Alpha', 'Beta']);
    expect(result.upgrades).toHaveLength(1);
    expect(result.upgrades[0]).toMatchObject({ grade: 'VF', targetGrade: 'XF' });
  });

  it('empty account returns setCount 0 and empty lists', async () => {
    mockPrismaService.userSet.count.mockResolvedValue(0);
    mockPrismaService.userSetCoin.findMany.mockResolvedValue([]);
    mockPrismaService.ownership.findMany.mockResolvedValue([]);

    await expect(service.getWantList(caller)).resolves.toEqual({ setCount: 0, missing: [], upgrades: [] });
  });

  it('counts sets with no coins in setCount', async () => {
    mockPrismaService.userSet.count.mockResolvedValue(2);
    mockPrismaService.userSetCoin.findMany.mockResolvedValue([]);
    mockPrismaService.ownership.findMany.mockResolvedValue([]);

    await expect(service.getWantList(caller)).resolves.toEqual({ setCount: 2, missing: [], upgrades: [] });
  });
});

describe('SetsController.getWantList', () => {
  let controller: SetsController;
  let mockSetsService: { getWantList: jest.Mock };

  const user: AuthenticatedUser = { userId: 'user-42' } as AuthenticatedUser;

  beforeEach(async () => {
    mockSetsService = { getWantList: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SetsController],
      providers: [{ provide: SetsService, useValue: mockSetsService }],
    }).compile();
    controller = module.get(SetsController);
  });

  it('delegates user.userId to the service and returns its result', async () => {
    const response: WantListResponse = { setCount: 2, missing: [], upgrades: [] };
    mockSetsService.getWantList.mockResolvedValue(response);

    const result = await controller.getWantList(user);

    expect(mockSetsService.getWantList).toHaveBeenCalledWith('user-42');
    expect(result).toBe(response);
  });

  it('passes a different caller id through', async () => {
    mockSetsService.getWantList.mockResolvedValue({ setCount: 0, missing: [], upgrades: [] });
    await controller.getWantList({ userId: 'other-user' } as AuthenticatedUser);
    expect(mockSetsService.getWantList).toHaveBeenCalledWith('other-user');
  });

  it('is not public', () => {
    const reflector = new Reflector();
    expect(reflector.get(IS_PUBLIC_KEY, SetsController.prototype.getWantList)).toBeFalsy();
  });

  it("is routed at 'wants'", () => {
    expect(Reflect.getMetadata('path', SetsController.prototype.getWantList)).toBe('wants');
  });

  it('is declared before the :id handlers so it is not shadowed', () => {
    const names = Object.getOwnPropertyNames(SetsController.prototype);
    const wants = names.indexOf('getWantList');
    expect(wants).toBeGreaterThan(-1);
    for (const handler of ['update', 'patchCoins', 'remove', 'getGaps']) {
      const index = names.indexOf(handler);
      expect(index).toBeGreaterThan(-1);
      expect(wants).toBeLessThan(index);
    }
  });
});

describe('WantListResponse types', () => {
  it('accepts a full response literal', () => {
    const base: WantCoin = { coin: coin('c1'), sets: [{ id: 's1', name: 'One' }] };
    const upgrade: UpgradeWant = { ...base, grade: null, targetGrade: 'XF' };
    const response: WantListResponse = { setCount: 1, missing: [base], upgrades: [upgrade] };
    expect(response.upgrades[0].targetGrade).toBe('XF');
    expect(response.upgrades[0].grade).toBeNull();
    expect(response.missing[0]).not.toHaveProperty('targetGrade');
  });

  it('requires targetGrade on UpgradeWant', () => {
    // @ts-expect-error targetGrade is required
    const bad: UpgradeWant = { coin: coin('c1'), sets: [], grade: 'F' };
    expect(bad).toBeDefined();
  });
});
