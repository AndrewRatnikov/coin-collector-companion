/**
 * Tests for: BulkSetOwnershipDto
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract (API: PATCH /collection)
 *                   runs/run_20261102_194108/plan.md § Interface Contract (API: PATCH /collection (bulk): unchanged)
 * Covers criteria: #10 (run_20261017_210503); #7 (run_20261102_194108)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator decorators (pure validation class, nothing to mock).
 */

import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BulkSetOwnershipDto } from './bulk-set-ownership.dto';

const UUID_A = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const UUID_B = '9b2e4f1c-8d3a-4c5b-a6e7-1f2d3c4b5a69';

async function validateBody(body: unknown) {
  const instance = plainToInstance(BulkSetOwnershipDto, body);
  return validate(instance);
}

describe('BulkSetOwnershipDto (criterion #10)', () => {
  it('passes with one uuid and owned: true', async () => {
    expect(await validateBody({ coinIds: [UUID_A], owned: true })).toHaveLength(0);
  });

  it('passes with several uuids and owned: false', async () => {
    expect(await validateBody({ coinIds: [UUID_A, UUID_B], owned: false })).toHaveLength(0);
  });

  it('passes with exactly 1000 ids', async () => {
    const ids = Array.from({ length: 1000 }, () => UUID_A);
    expect(await validateBody({ coinIds: ids, owned: true })).toHaveLength(0);
  });

  it('fails with 1001 ids', async () => {
    const ids = Array.from({ length: 1001 }, () => UUID_A);
    const errors = await validateBody({ coinIds: ids, owned: true });
    expect(errors.some((e) => e.property === 'coinIds')).toBe(true);
  });

  it('fails for an empty body', async () => {
    const errors = await validateBody({});
    expect(errors.some((e) => e.property === 'coinIds')).toBe(true);
    expect(errors.some((e) => e.property === 'owned')).toBe(true);
  });

  it('fails for an empty coinIds array', async () => {
    const errors = await validateBody({ coinIds: [], owned: true });
    expect(errors.some((e) => e.property === 'coinIds')).toBe(true);
  });

  it('fails when an id is not a uuid', async () => {
    const errors = await validateBody({ coinIds: ['not-a-uuid'], owned: true });
    expect(errors.some((e) => e.property === 'coinIds')).toBe(true);
  });

  it('fails when only one of several ids is not a uuid', async () => {
    const errors = await validateBody({ coinIds: [UUID_A, 'nope'], owned: true });
    expect(errors.some((e) => e.property === 'coinIds')).toBe(true);
  });

  it('fails when owned is a string', async () => {
    const errors = await validateBody({ coinIds: [UUID_A], owned: 'true' });
    expect(errors.some((e) => e.property === 'owned')).toBe(true);
  });

  it('fails when coinIds is a string, not an array', async () => {
    const errors = await validateBody({ coinIds: 'x', owned: true });
    expect(errors.some((e) => e.property === 'coinIds')).toBe(true);
  });
});

describe('BulkSetOwnershipDto never carries a grade (criterion #7 from run_20261102_194108)', () => {
  // Same options as configure-app.ts.
  const pipe = new ValidationPipe({ whitelist: true, transform: true });

  it('strips a stray grade key from the body instead of rejecting the request', async () => {
    const result = (await pipe.transform(
      { coinIds: [UUID_A], owned: true, grade: 'VF' },
      { type: 'body', metatype: BulkSetOwnershipDto },
    )) as BulkSetOwnershipDto;

    expect(result).not.toHaveProperty('grade');
    expect(result.coinIds).toEqual([UUID_A]);
    expect(result.owned).toBe(true);
  });

  it('strips even an invalid grade silently (it is not validated, it is dropped)', async () => {
    const result = (await pipe.transform(
      { coinIds: [UUID_A, UUID_B], owned: false, grade: 'Proof' },
      { type: 'body', metatype: BulkSetOwnershipDto },
    )) as BulkSetOwnershipDto;

    expect(result).not.toHaveProperty('grade');
    expect(result.coinIds).toEqual([UUID_A, UUID_B]);
  });

  it('still rejects a bad body when a grade is present', async () => {
    await expect(
      pipe.transform(
        { coinIds: ['nope'], owned: true, grade: 'VF' },
        { type: 'body', metatype: BulkSetOwnershipDto },
      ),
    ).rejects.toThrow();
  });
});
