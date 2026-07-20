/**
 * Tests for: CreateSetDto (and its nested CloneFromDto)
 * Contract source: runs/run_20260719_200109/plan.md § Interface Contract (DTO: CreateSetDto, DTO: CloneFromDto)
 * Covers criteria: #2 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator/class-transformer decorators declared on CreateSetDto
 * and CloneFromDto (no mocking possible or needed — these are pure validation classes with
 * no external dependencies). plainToInstance is required for the nested `cloneFrom` object to
 * become a real CloneFromDto instance before validate() can run its own decorators, matching
 * how Nest's global ValidationPipe ({ whitelist: true, transform: true }, apps/api/src/main.ts)
 * processes incoming request bodies at runtime.
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSetDto } from './create-set.dto';

async function validateBody(body: unknown) {
  const instance = plainToInstance(CreateSetDto, body);
  return validate(instance);
}

describe('CreateSetDto (criterion #2)', () => {
  // Must be a real RFC 4122 UUID (correct version/variant nibbles), not just UUID-shaped —
  // class-validator's @IsUUID() checks the variant nibble (must be 8/9/a/b), and a fixture
  // like '11111111-1111-1111-1111-111111111111' fails that even though it looks like a UUID.
  const validUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  it('passes with just a name (blank-set shape)', async () => {
    const errors = await validateBody({ name: 'My Set' });
    expect(errors).toHaveLength(0);
  });

  it('passes with a valid cloneFrom: { type: "canonical", id: <uuid> }', async () => {
    const errors = await validateBody({
      name: 'My Set',
      cloneFrom: { type: 'canonical', id: validUuid },
    });
    expect(errors).toHaveLength(0);
  });

  it('passes with a valid cloneFrom: { type: "user", id: <uuid> }', async () => {
    const errors = await validateBody({
      name: 'My Set',
      cloneFrom: { type: 'user', id: validUuid },
    });
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

  it('fails when cloneFrom.type is neither "canonical" nor "user"', async () => {
    const errors = await validateBody({
      name: 'My Set',
      cloneFrom: { type: 'bogus', id: validUuid },
    });
    const cloneFromError = errors.find((e) => e.property === 'cloneFrom');
    expect(cloneFromError).toBeDefined();
    expect(JSON.stringify(cloneFromError)).toContain('type');
  });

  it('fails when cloneFrom.id is not a valid UUID', async () => {
    const errors = await validateBody({
      name: 'My Set',
      cloneFrom: { type: 'canonical', id: 'not-a-uuid' },
    });
    const cloneFromError = errors.find((e) => e.property === 'cloneFrom');
    expect(cloneFromError).toBeDefined();
    expect(JSON.stringify(cloneFromError)).toContain('id');
  });
});
