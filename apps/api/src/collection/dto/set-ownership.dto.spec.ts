/**
 * Tests for: SetOwnershipDto
 * Contract source: runs/run_20260720_142942/plan.md § Interface Contract (DTO: SetOwnershipDto)
 * Covers criteria: #2 (from runs/run_20260720_142942/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator decorators declared on SetOwnershipDto (no mocking
 * possible or needed — a pure validation class with no external dependencies).
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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
