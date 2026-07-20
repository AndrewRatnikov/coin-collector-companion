/**
 * Tests for: UpdateSetDto
 * Contract source: runs/run_20260719_200109/plan.md § Interface Contract (DTO: UpdateSetDto)
 * Covers criteria: #8 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator decorators declared on UpdateSetDto — no mocking
 * possible or needed.
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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

  it('fails when name is missing', async () => {
    const errors = await validateBody({});
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails when name is an empty string', async () => {
    const errors = await validateBody({ name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});
