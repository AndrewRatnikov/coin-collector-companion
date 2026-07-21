/**
 * Tests for: shared package types (UserSetSummary, CloneFromRequest, CreateSetRequestBody,
 * CanonicalSetSummary, CanonicalSetCoinItem, CanonicalSetDetail, UserSetCoinItem, UserSetDetail,
 * UserSetCoinSummary, PatchSetCoinsRequest, OwnershipItem, SetOwnershipRequest,
 * SetOwnershipResponse, GapSlot, GapViewResponse)
 * Contract source: runs/run_20260719_200109/plan.md § Interface Contract (Shared types)
 *                   runs/run_20260720_070901/plan.md § Interface Contract (Shared types)
 *                   runs/run_20260720_142942/plan.md § Interface Contract (Shared types)
 * Covers criteria: #11 (from runs/run_20260719_200109/prd.md)
 *                   #17 (from runs/run_20260720_070901/prd.md)
 *                   #12 (from runs/run_20260720_142942/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * These are plain TypeScript interfaces with no runtime representation. apps/api's jest
 * config (apps/api/package.json's "jest" block) has no `isolatedModules` override, so
 * ts-jest type-checks every file it compiles — a type-only usage that doesn't compile
 * against the real packages/shared exports fails this test file the same way a missing or
 * renamed export would fail `pnpm --filter api build`. This is what gives criterion #12
 * (run_20260720_142942) a real, falsifiable signal from `pnpm --filter api test` rather than
 * deferring it entirely to the separate typecheck/build steps (pattern established Week 2
 * Day 1 per test-reviewer feedback, retry 1/2, and reused for every shared-type addition since).
 */

import type {
  CloneFromRequest,
  CreateSetRequestBody,
  UserSetSummary,
  CanonicalSetSummary,
  CanonicalSetCoinItem,
  CanonicalSetDetail,
  UserSetCoinItem,
  UserSetDetail,
  UserSetCoinSummary,
  PatchSetCoinsRequest,
  CatalogCoin,
  OwnershipItem,
  SetOwnershipRequest,
  SetOwnershipResponse,
  GapSlot,
  GapViewResponse,
} from '@coin-collector/shared';

const sampleCatalogCoin: CatalogCoin = {
  id: '99999999-9999-9999-9999-999999999999',
  country: 'USA',
  denomination: 'Cent',
  year: 1943,
  mintMark: '',
  variety: '',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('shared package: Sets types (criterion #11 from run_20260719_200109/prd.md)', () => {
  it('UserSetSummary has the expected flat UserSet shape', () => {
    const summary: UserSetSummary = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      name: 'My Set',
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(summary.name).toBe('My Set');
    expect(summary.clonedFromCanonicalId).toBeNull();
  });

  it('CloneFromRequest restricts type to "canonical" | "user"', () => {
    const canonical: CloneFromRequest = {
      type: 'canonical',
      id: '33333333-3333-3333-3333-333333333333',
    };
    const user: CloneFromRequest = {
      type: 'user',
      id: '44444444-4444-4444-4444-444444444444',
    };

    expect(canonical.type).toBe('canonical');
    expect(user.type).toBe('user');
  });

  it('CreateSetRequestBody makes cloneFrom optional', () => {
    const blank: CreateSetRequestBody = { name: 'Blank Set' };
    const cloned: CreateSetRequestBody = {
      name: 'Cloned Set',
      cloneFrom: { type: 'canonical', id: '55555555-5555-5555-5555-555555555555' },
    };

    expect(blank.cloneFrom).toBeUndefined();
    expect(cloned.cloneFrom?.type).toBe('canonical');
  });
});

describe('shared package: new Day 2 types (criterion #17 from run_20260720_070901/prd.md)', () => {
  it('CanonicalSetSummary has the expected flat CanonicalSet shape', () => {
    const summary: CanonicalSetSummary = {
      id: '66666666-6666-6666-6666-666666666666',
      name: 'Lincoln Wheat Cents',
      description: null,
      source: 'admin',
      templateVersion: '1',
    };

    expect(summary.name).toBe('Lincoln Wheat Cents');
    expect(summary.description).toBeNull();
  });

  it('CanonicalSetDetail extends CanonicalSetSummary with an ordered coins array of CanonicalSetCoinItem', () => {
    const coinItem: CanonicalSetCoinItem = {
      id: '77777777-7777-7777-7777-777777777777',
      position: 1,
      coin: sampleCatalogCoin,
    };
    const detail: CanonicalSetDetail = {
      id: '66666666-6666-6666-6666-666666666666',
      name: 'Lincoln Wheat Cents',
      description: null,
      source: 'admin',
      templateVersion: '1',
      coins: [coinItem],
    };

    expect(detail.coins).toHaveLength(1);
    expect(detail.coins[0].coin.name).toBe('Lincoln Wheat Cent');
  });

  it('UserSetDetail extends UserSetSummary with an ordered coins array of UserSetCoinItem', () => {
    const coinItem: UserSetCoinItem = {
      id: '88888888-8888-8888-8888-888888888888',
      position: 1,
      coin: sampleCatalogCoin,
    };
    const detail: UserSetDetail = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      name: 'A Public Set',
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      coins: [coinItem],
    };

    expect(detail.coins).toHaveLength(1);
    expect(detail.userId).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('UserSetCoinSummary is the flat join-row shape returned by PATCH /sets/:id/coins', () => {
    const row: UserSetCoinSummary = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      userSetId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      coinId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      position: 3,
    };

    expect(row.position).toBe(3);
  });

  it('PatchSetCoinsRequest makes both add and remove optional', () => {
    const empty: PatchSetCoinsRequest = {};
    const addOnly: PatchSetCoinsRequest = { add: ['dddddddd-dddd-dddd-dddd-dddddddddddd'] };
    const both: PatchSetCoinsRequest = {
      add: ['dddddddd-dddd-dddd-dddd-dddddddddddd'],
      remove: ['eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'],
    };

    expect(empty.add).toBeUndefined();
    expect(addOnly.remove).toBeUndefined();
    expect(both.add).toHaveLength(1);
    expect(both.remove).toHaveLength(1);
  });
});

describe('shared package: new Day 4 types — collection/ownership + gap view (criterion #12 from run_20260720_142942/prd.md)', () => {
  it('OwnershipItem pairs a coinId/coin with an ownedAt timestamp', () => {
    const item: OwnershipItem = {
      coinId: sampleCatalogCoin.id,
      coin: sampleCatalogCoin,
      ownedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    expect(item.coin.name).toBe('Lincoln Wheat Cent');
    expect(item.ownedAt).toBeInstanceOf(Date);
  });

  it('SetOwnershipRequest is a bare { owned: boolean } body', () => {
    const trueBody: SetOwnershipRequest = { owned: true };
    const falseBody: SetOwnershipRequest = { owned: false };

    expect(trueBody.owned).toBe(true);
    expect(falseBody.owned).toBe(false);
  });

  it('SetOwnershipResponse allows ownedAt to be null (the owned: false case)', () => {
    const owned: SetOwnershipResponse = {
      coinId: sampleCatalogCoin.id,
      owned: true,
      ownedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const notOwned: SetOwnershipResponse = {
      coinId: sampleCatalogCoin.id,
      owned: false,
      ownedAt: null,
    };

    expect(owned.ownedAt).not.toBeNull();
    expect(notOwned.ownedAt).toBeNull();
  });

  it('GapSlot carries the UserSetCoin row id, position, coin, and a computed owned flag', () => {
    const slot: GapSlot = {
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      position: 1,
      coin: sampleCatalogCoin,
      owned: true,
    };

    expect(slot.owned).toBe(true);
    expect(slot.coin).toBe(sampleCatalogCoin);
  });

  it('GapViewResponse aggregates slots with ownedCount/totalCount/completionPercent', () => {
    const response: GapViewResponse = {
      setId: '11111111-1111-1111-1111-111111111111',
      ownedCount: 1,
      totalCount: 2,
      completionPercent: 50,
      slots: [
        { id: 'usc-1', position: 1, coin: sampleCatalogCoin, owned: true },
        { id: 'usc-2', position: 2, coin: sampleCatalogCoin, owned: false },
      ],
    };

    expect(response.slots).toHaveLength(2);
    expect(response.completionPercent).toBe(50);
  });
});
