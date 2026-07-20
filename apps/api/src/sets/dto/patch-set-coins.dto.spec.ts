/**
 * Tests for: PatchSetCoinsDto
 * Contract source: runs/run_20260720_070901/plan.md § Interface Contract (DTO: PatchSetCoinsDto)
 * Covers criteria: #2 (from runs/run_20260720_070901/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator/class-transformer decorators declared on PatchSetCoinsDto
 * (no mocking possible or needed — this is a pure validation class with no external
 * dependencies). plainToInstance mirrors how Nest's global ValidationPipe ({ whitelist: true,
 * transform: true }, apps/api/src/main.ts) processes incoming request bodies at runtime,
 * matching the pattern already established in create-set.dto.spec.ts.
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PatchSetCoinsDto } from './patch-set-coins.dto';

async function validateBody(body: unknown) {
  const instance = plainToInstance(PatchSetCoinsDto, body);
  return validate(instance);
}

describe('PatchSetCoinsDto (criterion #2)', () => {
  // Must be real RFC 4122 UUIDs (correct version/variant nibbles), not just UUID-shaped —
  // class-validator's @IsUUID() checks the variant nibble (must be 8/9/a/b), and a fixture
  // like '11111111-1111-1111-1111-111111111111' fails that even though it looks like a UUID.
  const uuidA = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
  const uuidB = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

  it('passes with an empty body (no-op)', async () => {
    const errors = await validateBody({});
    expect(errors).toHaveLength(0);
  });

  it('passes with a valid add array', async () => {
    const errors = await validateBody({ add: [uuidA, uuidB] });
    expect(errors).toHaveLength(0);
  });

  it('passes with a valid remove array', async () => {
    const errors = await validateBody({ remove: [uuidA] });
    expect(errors).toHaveLength(0);
  });

  it('passes with both add and remove present', async () => {
    const errors = await validateBody({ add: [uuidA], remove: [uuidB] });
    expect(errors).toHaveLength(0);
  });

  it('fails when add contains a non-UUID string', async () => {
    const errors = await validateBody({ add: ['not-a-uuid'] });
    const addError = errors.find((e) => e.property === 'add');
    expect(addError).toBeDefined();
  });

  it('fails when remove contains a non-UUID string', async () => {
    const errors = await validateBody({ remove: ['not-a-uuid'] });
    const removeError = errors.find((e) => e.property === 'remove');
    expect(removeError).toBeDefined();
  });

  it('fails when add is not an array', async () => {
    const errors = await validateBody({ add: 'not-an-array' });
    const addError = errors.find((e) => e.property === 'add');
    expect(addError).toBeDefined();
  });

  it('fails when remove is not an array', async () => {
    const errors = await validateBody({ remove: 'not-an-array' });
    const removeError = errors.find((e) => e.property === 'remove');
    expect(removeError).toBeDefined();
  });
});
