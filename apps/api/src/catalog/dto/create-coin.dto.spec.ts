/**
 * Tests for: CreateCoinDto
 * Contract source: runs/run_20260725_140648/plan.md § Interface Contract → Backend — apps/api/src/catalog/dto/create-coin.dto.ts (CREATE)
 * Covers criteria: #3 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator/class-transformer decorators declared on CreateCoinDto
 * (no mocking possible or needed — a pure validation/transform class with no external
 * dependencies beyond the real, already-a-dependency sanitizeIdentityField). Follows the same
 * plainToInstance + validate() convention as apps/api/src/sets/dto/create-set.dto.spec.ts.
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCoinDto } from './create-coin.dto';

async function validateBody(body: unknown) {
  const instance = plainToInstance(CreateCoinDto, body);
  return { instance, errors: await validate(instance) };
}

const CURRENT_YEAR = new Date().getFullYear();

describe('CreateCoinDto (criterion #3)', () => {
  const VALID_BODY = {
    country: 'USA',
    denomination: '1 Cent',
    name: 'Indian Head Cent',
    year: 1900,
  };

  it('passes with just the required fields (no mintMark/variety)', async () => {
    const { errors } = await validateBody(VALID_BODY);
    expect(errors).toHaveLength(0);
  });

  it('passes with mintMark and variety provided', async () => {
    const { errors } = await validateBody({ ...VALID_BODY, mintMark: 'D', variety: 'Doubled Die' });
    expect(errors).toHaveLength(0);
  });

  it('trims whitespace from country/denomination/name', async () => {
    const { instance } = await validateBody({
      ...VALID_BODY,
      country: '  USA  ',
      denomination: '  1 Cent  ',
      name: '  Indian Head Cent  ',
    });
    expect(instance.country).toBe('USA');
    expect(instance.denomination).toBe('1 Cent');
    expect(instance.name).toBe('Indian Head Cent');
  });

  it('normalizes mintMark through sanitizeIdentityField: "None" collapses to empty string', async () => {
    const { instance, errors } = await validateBody({ ...VALID_BODY, mintMark: 'None' });
    expect(instance.mintMark).toBe('');
    expect(errors).toHaveLength(0);
  });

  it('normalizes variety through sanitizeIdentityField: "n/a" collapses to empty string', async () => {
    const { instance, errors } = await validateBody({ ...VALID_BODY, variety: 'n/a' });
    expect(instance.variety).toBe('');
    expect(errors).toHaveLength(0);
  });

  it('normalizes mintMark to an empty string when omitted entirely (never undefined downstream)', async () => {
    const { instance } = await validateBody(VALID_BODY);
    expect(instance.mintMark).toBe('');
  });

  it('trims and preserves a real mintMark value ("  D  " -> "D")', async () => {
    const { instance } = await validateBody({ ...VALID_BODY, mintMark: '  D  ' });
    expect(instance.mintMark).toBe('D');
  });

  it('fails when country is missing', async () => {
    const rest: Record<string, unknown> = { ...VALID_BODY };
    delete rest.country;
    const { errors } = await validateBody(rest);
    expect(errors.some((e) => e.property === 'country')).toBe(true);
  });

  it('fails when denomination is missing', async () => {
    const rest: Record<string, unknown> = { ...VALID_BODY };
    delete rest.denomination;
    const { errors } = await validateBody(rest);
    expect(errors.some((e) => e.property === 'denomination')).toBe(true);
  });

  it('fails when name is missing', async () => {
    const rest: Record<string, unknown> = { ...VALID_BODY };
    delete rest.name;
    const { errors } = await validateBody(rest);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails when year is below 1000', async () => {
    const { errors } = await validateBody({ ...VALID_BODY, year: 999 });
    expect(errors.some((e) => e.property === 'year')).toBe(true);
  });

  it('fails when year is more than one year in the future', async () => {
    const { errors } = await validateBody({ ...VALID_BODY, year: CURRENT_YEAR + 2 });
    expect(errors.some((e) => e.property === 'year')).toBe(true);
  });

  it('passes when year is exactly current year + 1 (the upper bound is inclusive)', async () => {
    const { errors } = await validateBody({ ...VALID_BODY, year: CURRENT_YEAR + 1 });
    expect(errors.filter((e) => e.property === 'year')).toHaveLength(0);
  });

  it('fails when year is not an integer', async () => {
    const { errors } = await validateBody({ ...VALID_BODY, year: 1900.5 });
    expect(errors.some((e) => e.property === 'year')).toBe(true);
  });
});
