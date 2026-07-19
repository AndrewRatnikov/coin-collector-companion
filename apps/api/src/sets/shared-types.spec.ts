/**
 * Tests for: shared package types (UserSetSummary, CloneFromRequest, CreateSetRequestBody)
 * Contract source: runs/run_20260719_200109/plan.md § Interface Contract (Shared types: packages/shared/src/index.ts)
 * Covers criteria: #11 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * These are plain TypeScript interfaces with no runtime representation. apps/api's jest
 * config (apps/api/package.json's "jest" block) has no `isolatedModules` override, so
 * ts-jest type-checks every file it compiles — a type-only usage that doesn't compile
 * against the real packages/shared exports fails this test file the same way a missing or
 * renamed export would fail `pnpm --filter api build`. This is what gives criterion #11 a
 * real, falsifiable signal from `pnpm --filter api test` rather than deferring it entirely
 * to the separate typecheck/build steps (added per test-reviewer feedback, retry 1/2).
 */

import type {
  CloneFromRequest,
  CreateSetRequestBody,
  UserSetSummary,
} from '@coin-collector/shared';

describe('shared package: Sets types (criterion #11)', () => {
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
