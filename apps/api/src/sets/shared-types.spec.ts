/**
 * Tests for: shared package types (UserSetSummary, CloneFromRequest, CreateSetRequestBody,
 * CanonicalSetSummary, CanonicalSetCoinItem, CanonicalSetDetail, UserSetCoinItem, UserSetDetail,
 * UserSetCoinSummary, PatchSetCoinsRequest, OwnershipItem, SetOwnershipRequest,
 * SetOwnershipResponse, GapSlot, GapViewResponse, PublicSetSummary, UserSetListItem,
 * SuggestedCanonicalSet, UserSetsSummaryResponse, UpdateSetRequest, CoinGrade)
 * Contract source: runs/run_20260719_200109/plan.md § Interface Contract (Shared types)
 *                   runs/run_20260720_070901/plan.md § Interface Contract (Shared types)
 *                   runs/run_20260720_142942/plan.md § Interface Contract (Shared types)
 *                   runs/run_20261013_062900/plan.md § Interface Contract (Shared types)
 *                   runs/run_20261018_105617/plan.md § Interface Contract (Shared types)
 *                   runs/run_20261102_194108/plan.md § Interface Contract (Shared: widened types)
 * Covers criteria: #11 (from runs/run_20260719_200109/prd.md)
 *                   #17 (from runs/run_20260720_070901/prd.md)
 *                   #12 (from runs/run_20260720_142942/prd.md)
 *                   #18, #19 (from runs/run_20261013_062900/prd.md)
 *                   #2, #3, #7 (from runs/run_20261018_105617/prd.md)
 *                   #3, #5, #10, #11, #12, #13 (from runs/run_20261102_194108/prd.md)
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
 *
 * For run_20261013_062900 the `@ts-expect-error` lines pin the type shape: a CanonicalSetDetail
 * literal must NOT accept `coinCount` (it is `Omit<CanonicalSetSummary, 'coinCount'>`-based), and
 * a PublicSetSummary literal must require it. If the types drift, the directive becomes unused
 * and ts-jest fails the file. The same technique pins UserSetListItem (run_20261018_105617) and
 * the coin grade fields (run_20261102_194108): grade / minGrade are required and nullable,
 * needsUpgrade / upgradeCount are optional.
 */

import type {
  CloneFromRequest,
  CreateSetRequestBody,
  UserSetSummary,
  UserSetListItem,
  SuggestedCanonicalSet,
  UserSetsSummaryResponse,
  CanonicalSetSummary,
  CanonicalSetCoinItem,
  CanonicalSetDetail,
  PublicSetSummary,
  UserSetCoinItem,
  UserSetDetail,
  UserSetCoinSummary,
  PatchSetCoinsRequest,
  CatalogCoin,
  CoinGrade,
  OwnershipItem,
  SetOwnershipRequest,
  SetOwnershipResponse,
  GapSlot,
  GapViewResponse,
  UpdateSetRequest,
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
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: null,
  mintage: null,
  isKeyDate: false,
  status: 'approved',
  submittedAt: null,
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
      minGrade: null,
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
  it('CanonicalSetSummary has the expected flat CanonicalSet shape plus a numeric coinCount', () => {
    const summary: CanonicalSetSummary = {
      id: '66666666-6666-6666-6666-666666666666',
      name: 'Lincoln Wheat Cents',
      description: null,
      source: 'admin',
      templateVersion: '1',
      coinCount: 187,
    };

    expect(summary.name).toBe('Lincoln Wheat Cents');
    expect(summary.description).toBeNull();
    expect(summary.coinCount).toBe(187);
  });

  it('CanonicalSetSummary requires coinCount (criterion #18 from run_20261013_062900/prd.md)', () => {
    // @ts-expect-error coinCount is required on the list summary
    const missing: CanonicalSetSummary = {
      id: '66666666-6666-6666-6666-666666666666',
      name: 'Lincoln Wheat Cents',
      description: null,
      source: 'admin',
      templateVersion: '1',
    };

    expect(missing.name).toBe('Lincoln Wheat Cents');
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

  it('CanonicalSetDetail carries no coinCount (criterion #18 from run_20261013_062900/prd.md)', () => {
    const detail: CanonicalSetDetail = {
      id: '66666666-6666-6666-6666-666666666666',
      name: 'Lincoln Wheat Cents',
      description: null,
      source: 'admin',
      templateVersion: '1',
      // @ts-expect-error the detail type omits coinCount (clients count `coins`)
      coinCount: 1,
      coins: [],
    };

    expect(detail.coins).toHaveLength(0);
  });

  it('CanonicalSetDetail has no minGrade (canonical sets carry no goal)', () => {
    const detail: CanonicalSetDetail = {
      id: '66666666-6666-6666-6666-666666666666',
      name: 'Lincoln Wheat Cents',
      description: null,
      source: 'admin',
      templateVersion: '1',
      // @ts-expect-error canonical sets have no minGrade
      minGrade: null,
      coins: [],
    };

    expect(detail.coins).toHaveLength(0);
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
      minGrade: null,
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

describe('shared package: PublicSetSummary (criterion #19 from run_20261013_062900/prd.md)', () => {
  it('extends UserSetSummary with a numeric coinCount', () => {
    const summary: PublicSetSummary = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      name: "Bob's Set",
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      minGrade: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      coinCount: 42,
    };
    const asUserSummary: UserSetSummary = summary;

    expect(summary.coinCount).toBe(42);
    expect(asUserSummary.name).toBe("Bob's Set");
  });

  it('requires coinCount', () => {
    // @ts-expect-error coinCount is required on the public list summary
    const missing: PublicSetSummary = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      name: "Bob's Set",
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      minGrade: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(missing.name).toBe("Bob's Set");
  });

  it('leaves UserSetSummary without a coinCount', () => {
    const summary: UserSetSummary = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      name: 'Own set',
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      minGrade: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      // @ts-expect-error UserSetSummary itself is unchanged and has no coinCount
      coinCount: 1,
    };

    expect(summary.name).toBe('Own set');
  });
});

describe('shared package: UserSetListItem (criterion #2 from run_20261018_105617/prd.md)', () => {
  it('extends UserSetSummary with ownedCount, totalCount and a nullable firstMissing', () => {
    const inProgress: UserSetListItem = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      name: 'We Are Strong',
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      minGrade: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ownedCount: 11,
      totalCount: 12,
      firstMissing: 'Zaporizhzhia Oblast',
    };
    const complete: UserSetListItem = { ...inProgress, ownedCount: 12, firstMissing: null };
    const asUserSummary: UserSetSummary = inProgress;

    expect(inProgress.firstMissing).toBe('Zaporizhzhia Oblast');
    expect(complete.firstMissing).toBeNull();
    expect(complete.ownedCount).not.toBe(inProgress.ownedCount);
    expect(asUserSummary.name).toBe('We Are Strong');
  });

  it('requires ownedCount, totalCount and firstMissing', () => {
    // @ts-expect-error the list item requires the progress fields
    const missing: UserSetListItem = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      name: 'No progress',
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      minGrade: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(missing.name).toBe('No progress');
  });

  it('leaves UserSetSummary without the progress fields', () => {
    const summary: UserSetSummary = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      name: 'Own set',
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      minGrade: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      // @ts-expect-error UserSetSummary itself stays count-free (create and rename responses)
      ownedCount: 1,
    };

    expect(summary.name).toBe('Own set');
  });
});

describe('shared package: UserSetsSummaryResponse (criteria #3, #7 from run_20261018_105617/prd.md)', () => {
  it('SuggestedCanonicalSet carries id, name, coinCount and ownedCount', () => {
    const suggestion: SuggestedCanonicalSet = {
      id: 'cs-1',
      name: 'Ukraine circulation coins',
      coinCount: 40,
      ownedCount: 7,
    };

    expect(suggestion.coinCount).toBe(40);
    expect(suggestion.ownedCount).toBe(7);
  });

  it('UserSetsSummaryResponse allows suggestedSet to be a suggestion or null', () => {
    const withSuggestion: UserSetsSummaryResponse = {
      uniqueMissingCount: 9,
      collectionCount: 31,
      suggestedSet: { id: 'cs-1', name: 'Lincoln Cents', coinCount: 12, ownedCount: 3 },
    };
    const without: UserSetsSummaryResponse = {
      uniqueMissingCount: 0,
      collectionCount: 0,
      suggestedSet: null,
    };

    expect(withSuggestion.suggestedSet?.id).toBe('cs-1');
    expect(without.suggestedSet).toBeNull();
    expect(withSuggestion.uniqueMissingCount).not.toBe(without.uniqueMissingCount);
  });

  it('requires uniqueMissingCount and collectionCount', () => {
    // @ts-expect-error both counts are required on the summary response
    const missing: UserSetsSummaryResponse = { suggestedSet: null };

    expect(missing.suggestedSet).toBeNull();
  });
});

describe('shared package: new Day 4 types — collection/ownership + gap view (criterion #12 from run_20260720_142942/prd.md)', () => {
  it('OwnershipItem pairs a coinId/coin with an ownedAt timestamp and a nullable grade', () => {
    const item: OwnershipItem = {
      coinId: sampleCatalogCoin.id,
      coin: sampleCatalogCoin,
      ownedAt: new Date('2026-01-01T00:00:00.000Z'),
      grade: null,
    };

    expect(item.coin.name).toBe('Lincoln Wheat Cent');
    expect(item.ownedAt).toBeInstanceOf(Date);
    expect(item.grade).toBeNull();
  });

  it('SetOwnershipRequest is { owned: boolean } with an optional grade', () => {
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
      grade: 'VF',
    };
    const notOwned: SetOwnershipResponse = {
      coinId: sampleCatalogCoin.id,
      owned: false,
      ownedAt: null,
      grade: null,
    };

    expect(owned.ownedAt).not.toBeNull();
    expect(notOwned.ownedAt).toBeNull();
    expect(owned.grade).not.toBe(notOwned.grade);
  });

  it('GapSlot carries the UserSetCoin row id, position, coin, a computed owned flag and a nullable grade', () => {
    const slot: GapSlot = {
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      position: 1,
      coin: sampleCatalogCoin,
      owned: true,
      grade: null,
    };

    expect(slot.owned).toBe(true);
    expect(slot.coin).toBe(sampleCatalogCoin);
  });

  it('GapViewResponse aggregates slots with ownedCount/totalCount/completionPercent and a nullable minGrade', () => {
    const response: GapViewResponse = {
      setId: '11111111-1111-1111-1111-111111111111',
      ownedCount: 1,
      totalCount: 2,
      completionPercent: 50,
      minGrade: null,
      slots: [
        { id: 'usc-1', position: 1, coin: sampleCatalogCoin, owned: true, grade: null },
        { id: 'usc-2', position: 2, coin: sampleCatalogCoin, owned: false, grade: null },
      ],
    };

    expect(response.slots).toHaveLength(2);
    expect(response.completionPercent).toBe(50);
  });
});

describe('shared package: coin grades (criteria #3, #10, #11, #12, #13 from run_20261102_194108/prd.md)', () => {
  it('CoinGrade accepts the seven scale values and rejects anything else', () => {
    const all: CoinGrade[] = ['G', 'VG', 'F', 'VF', 'XF', 'AU', 'UNC'];
    // @ts-expect-error "Proof" is a strike type, not a grade
    const proof: CoinGrade = 'Proof';
    // @ts-expect-error grades are upper-case
    const lower: CoinGrade = 'vf';

    expect(all).toHaveLength(7);
    expect(proof).not.toBe(lower);
  });

  it('UserSetSummary requires a nullable minGrade', () => {
    // @ts-expect-error minGrade is required on every user set summary
    const missing: UserSetSummary = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      name: 'No goal key',
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const withGoal: UserSetSummary = { ...missing, minGrade: 'XF' };
    const withoutGoal: UserSetSummary = { ...missing, minGrade: null };

    expect(withGoal.minGrade).toBe('XF');
    expect(withoutGoal.minGrade).toBeNull();
  });

  it('OwnershipItem requires grade', () => {
    // @ts-expect-error grade is required on OwnershipItem
    const missing: OwnershipItem = {
      coinId: sampleCatalogCoin.id,
      coin: sampleCatalogCoin,
      ownedAt: new Date(),
    };
    const graded: OwnershipItem = { ...missing, grade: 'AU' };

    expect(graded.grade).toBe('AU');
  });

  it('SetOwnershipResponse requires grade', () => {
    // @ts-expect-error grade is required on SetOwnershipResponse
    const missing: SetOwnershipResponse = {
      coinId: sampleCatalogCoin.id,
      owned: true,
      ownedAt: new Date(),
    };
    const graded: SetOwnershipResponse = { ...missing, grade: 'G' };

    expect(graded.grade).toBe('G');
  });

  it('SetOwnershipRequest accepts an absent grade, null and a scale value, but not "Proof"', () => {
    const absent: SetOwnershipRequest = { owned: true };
    const cleared: SetOwnershipRequest = { owned: true, grade: null };
    const graded: SetOwnershipRequest = { owned: true, grade: 'VF' };
    const invalid: SetOwnershipRequest = {
      owned: true,
      // @ts-expect-error "Proof" is not a grade
      grade: 'Proof',
    };

    expect(absent.grade).toBeUndefined();
    expect(cleared.grade).toBeNull();
    expect(graded.grade).toBe('VF');
    expect(invalid.owned).toBe(true);
  });

  it('GapSlot requires grade but not needsUpgrade', () => {
    // @ts-expect-error grade is required on GapSlot
    const withoutGrade: GapSlot = {
      id: 'usc-1',
      position: 1,
      coin: sampleCatalogCoin,
      owned: true,
    };
    const withoutUpgrade: GapSlot = { ...withoutGrade, grade: 'F' };
    const withUpgrade: GapSlot = { ...withoutGrade, grade: 'F', needsUpgrade: true };

    expect(withoutUpgrade.needsUpgrade).toBeUndefined();
    expect(withUpgrade.needsUpgrade).toBe(true);
  });

  it('GapViewResponse requires minGrade but not upgradeCount', () => {
    // @ts-expect-error minGrade is required on GapViewResponse
    const withoutMinGrade: GapViewResponse = {
      setId: '11111111-1111-1111-1111-111111111111',
      ownedCount: 0,
      totalCount: 0,
      completionPercent: 0,
      slots: [],
    };
    const noGoal: GapViewResponse = { ...withoutMinGrade, minGrade: null };
    const goal: GapViewResponse = { ...withoutMinGrade, minGrade: 'VF', upgradeCount: 2 };

    expect(noGoal.upgradeCount).toBeUndefined();
    expect(goal.upgradeCount).toBe(2);
    expect(goal.minGrade).not.toBe(noGoal.minGrade);
  });

  it('UpdateSetRequest takes name and/or minGrade, each optional', () => {
    const empty: UpdateSetRequest = {};
    const renameOnly: UpdateSetRequest = { name: 'Renamed' };
    const goalOnly: UpdateSetRequest = { minGrade: 'XF' };
    const clear: UpdateSetRequest = { minGrade: null };
    const both: UpdateSetRequest = { name: 'Renamed', minGrade: 'AU' };
    const invalid: UpdateSetRequest = {
      // @ts-expect-error "Proof" is not a grade
      minGrade: 'Proof',
    };

    expect(empty.name).toBeUndefined();
    expect(renameOnly.minGrade).toBeUndefined();
    expect(goalOnly.minGrade).toBe('XF');
    expect(clear.minGrade).toBeNull();
    expect(both.name).toBe('Renamed');
    expect(invalid.name).toBeUndefined();
  });
});
