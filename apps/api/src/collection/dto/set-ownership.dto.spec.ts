/**
 * Tests for: SetOwnershipDto
 * Contract source: runs/run_20260720_142942/plan.md § Interface Contract (DTO: SetOwnershipDto)
 *                   runs/run_20261102_194108/plan.md § Interface Contract (API: PATCH /collection/:coinId)
 * Covers criteria: #2 (from runs/run_20260720_142942/prd.md); #5, #8 (from runs/run_20261102_194108/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator decorators declared on SetOwnershipDto (no mocking
 * possible or needed — a pure validation class with no external dependencies).
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { COIN_GRADES } from '@coin-collector/shared';
import { SetOwnershipDto } from './set-ownership.dto';

async function validateBody(body: unknown) {
  const instance = plainToInstance(SetOwnershipDto, body);
  return validate(instance);
}

describe('SetOwnershipDto (criterion #2)', () => {
  it('passes with owned: true', async () => {
    const errors = await validateBody({ owned: true });
    expect(errors).toHaveLength(0);
  });

  it('passes with owned: false', async () => {
    const errors = await validateBody({ owned: false });
    expect(errors).toHaveLength(0);
  });

  it('fails when owned is missing', async () => {
    const errors = await validateBody({});
    expect(errors.some((e) => e.property === 'owned')).toBe(true);
  });

  it('fails when owned is a string, not a boolean', async () => {
    const errors = await validateBody({ owned: 'true' });
    expect(errors.some((e) => e.property === 'owned')).toBe(true);
  });

  it('fails when owned is a number, not a boolean', async () => {
    const errors = await validateBody({ owned: 1 });
    expect(errors.some((e) => e.property === 'owned')).toBe(true);
  });

  it('fails when owned is null', async () => {
    const errors = await validateBody({ owned: null });
    expect(errors.some((e) => e.property === 'owned')).toBe(true);
  });
});

describe('SetOwnershipDto grade (criteria #5, #8 from run_20261102_194108)', () => {
  it.each([...COIN_GRADES])('passes with grade %s', async (grade) => {
    const errors = await validateBody({ owned: true, grade });
    expect(errors).toHaveLength(0);
  });

  it('passes with grade: null (clears the grade)', async () => {
    const errors = await validateBody({ owned: true, grade: null });
    expect(errors).toHaveLength(0);
  });

  it('passes with grade absent, and leaves dto.grade undefined (not null)', async () => {
    const instance = plainToInstance(SetOwnershipDto, { owned: true });
    const errors = await validate(instance);

    expect(errors).toHaveLength(0);
    expect(instance.grade).toBeUndefined();
  });

  it('keeps an explicit null as null, distinct from absent', async () => {
    const instance = plainToInstance(SetOwnershipDto, { owned: true, grade: null });

    expect(instance.grade).toBeNull();
  });

  it('passes with grade alongside owned: false (the service ignores it)', async () => {
    const errors = await validateBody({ owned: false, grade: 'VF' });
    expect(errors).toHaveLength(0);
  });

  it.each(['Proof', 'vf', 'Vf', 'MS65', '', ' VF', 'VF ', 'good'])(
    'fails with grade %j',
    async (grade) => {
      const errors = await validateBody({ owned: true, grade });
      expect(errors.some((e) => e.property === 'grade')).toBe(true);
    },
  );

  it('fails with a numeric grade', async () => {
    const errors = await validateBody({ owned: true, grade: 7 });
    expect(errors.some((e) => e.property === 'grade')).toBe(true);
  });

  it('fails with a boolean grade', async () => {
    const errors = await validateBody({ owned: true, grade: false });
    expect(errors.some((e) => e.property === 'grade')).toBe(true);
  });

  it('fails with an array grade', async () => {
    const errors = await validateBody({ owned: true, grade: ['VF'] });
    expect(errors.some((e) => e.property === 'grade')).toBe(true);
  });

  it('still fails on a missing owned even with a valid grade', async () => {
    const errors = await validateBody({ grade: 'VF' });
    expect(errors.some((e) => e.property === 'owned')).toBe(true);
    expect(errors.some((e) => e.property === 'grade')).toBe(false);
  });
});
