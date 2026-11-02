/**
 * Tests for: UpdateSetDto
 * Contract source: runs/run_20260719_200109/plan.md § Interface Contract (DTO: UpdateSetDto)
 *                   runs/run_20261102_194108/plan.md § Interface Contract (API: PATCH /api/v1/sets/:id)
 * Covers criteria: #8 (from runs/run_20260719_200109/prd.md); #8, #12 (from runs/run_20261102_194108/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator decorators declared on UpdateSetDto — no mocking
 * possible or needed. The body is now partial (name? and minGrade?); the service, not the DTO,
 * rejects an empty body.
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { COIN_GRADES } from '@coin-collector/shared';
import { UpdateSetDto } from './update-set.dto';

async function validateBody(body: unknown) {
  const instance = plainToInstance(UpdateSetDto, body);
  return validate(instance);
}

describe('UpdateSetDto (criterion #8)', () => {
  it('passes with a non-empty name', async () => {
    const errors = await validateBody({ name: 'Renamed Set' });
    expect(errors).toHaveLength(0);
  });

  it('passes with no keys at the DTO level (the service rejects an empty body)', async () => {
    const errors = await validateBody({});
    expect(errors).toHaveLength(0);
  });

  it('fails when name is an empty string', async () => {
    const errors = await validateBody({ name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails when name is null (would otherwise hit a NOT NULL column)', async () => {
    const errors = await validateBody({ name: null });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails when name is not a string', async () => {
    const errors = await validateBody({ name: 42 });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});

describe('UpdateSetDto minGrade (criteria #8, #12 from run_20261102_194108)', () => {
  it.each([...COIN_GRADES])('passes with minGrade %s', async (minGrade) => {
    const errors = await validateBody({ minGrade });
    expect(errors).toHaveLength(0);
  });

  it('passes with minGrade: null (clears the goal)', async () => {
    const errors = await validateBody({ minGrade: null });
    expect(errors).toHaveLength(0);
  });

  it('passes with name and minGrade together', async () => {
    const errors = await validateBody({ name: 'Renamed', minGrade: 'XF' });
    expect(errors).toHaveLength(0);
  });

  it('keeps an explicit null as null and an absent key undefined', () => {
    const withNull = plainToInstance(UpdateSetDto, { minGrade: null });
    const absent = plainToInstance(UpdateSetDto, { name: 'X' });

    expect(withNull.minGrade).toBeNull();
    expect(absent.minGrade).toBeUndefined();
  });

  it.each(['Proof', 'vf', 'bogus', '', 'MS65'])('fails with minGrade %j', async (minGrade) => {
    const errors = await validateBody({ minGrade });
    expect(errors.some((e) => e.property === 'minGrade')).toBe(true);
  });

  it('fails with a numeric minGrade', async () => {
    const errors = await validateBody({ minGrade: 7 });
    expect(errors.some((e) => e.property === 'minGrade')).toBe(true);
  });

  it('fails on a valid minGrade combined with an empty name', async () => {
    const errors = await validateBody({ name: '', minGrade: 'XF' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
    expect(errors.some((e) => e.property === 'minGrade')).toBe(false);
  });
});
