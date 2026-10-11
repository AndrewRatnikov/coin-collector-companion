/**
 * Tests for: FindCatalogQueryDto.submittedByMe
 * Contract source: runs/run_20260731_132040/plan.md § Interface Contract → DTO field: FindCatalogQueryDto.submittedByMe (MODIFY),
 *                   DTO test file: find-catalog-query.dto.spec.ts (CREATE)
 * Covers criteria: #1, #2, #3 (from prd.md)
 *
 * run_20261011_105146: adds denomination (single or repeated), keyDateOnly, hideOwned and sort.
 * Contract source: runs/run_20261011_105146/plan.md § Interface Contract → DTO: FindCatalogQueryDto
 * Covers criteria: #1, #2, #3, #4 (from run_20261011_105146's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator/class-transformer decorators declared on
 * FindCatalogQueryDto (no mocking — a pure validation/transform class). Follows the same
 * plainToInstance + validate() convention as create-coin.dto.spec.ts. This is the only test
 * file that actually proves the query-string "true"/"false" transform works end to end —
 * catalog.service.spec.ts/catalog.controller.spec.ts construct the DTO via
 * `Object.assign(new FindCatalogQueryDto(), overrides)`, which bypasses class-transformer's
 * @Transform pipeline entirely.
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindCatalogQueryDto } from './find-catalog-query.dto';

async function validateQuery(query: Record<string, unknown>) {
  const instance = plainToInstance(FindCatalogQueryDto, query);
  return { instance, errors: await validate(instance) };
}

describe('FindCatalogQueryDto.submittedByMe (criteria #1, #2, #3)', () => {
  it('transforms the query string "true" into the real boolean true', async () => {
    const { instance, errors } = await validateQuery({ submittedByMe: 'true' });
    expect(instance.submittedByMe).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('transforms the query string "false" into the real boolean false', async () => {
    const { instance, errors } = await validateQuery({ submittedByMe: 'false' });
    expect(instance.submittedByMe).toBe(false);
    expect(errors).toHaveLength(0);
  });

  it('leaves submittedByMe undefined (not false) when the key is entirely absent, with no validation errors', async () => {
    const { instance, errors } = await validateQuery({});
    expect(instance.submittedByMe).toBeUndefined();
    expect(errors).toHaveLength(0);
  });

  it('transforms any non-"true" string value to false (e.g. "yes"), still with no validation errors', async () => {
    const { instance, errors } = await validateQuery({ submittedByMe: 'yes' });
    expect(instance.submittedByMe).toBe(false);
    expect(errors).toHaveLength(0);
  });

  it('does not affect the other existing query fields when submittedByMe is present', async () => {
    const { instance, errors } = await validateQuery({ submittedByMe: 'true', country: 'USA', yearMin: '1909' });
    expect(instance.submittedByMe).toBe(true);
    expect(instance.country).toBe('USA');
    expect(instance.yearMin).toBe(1909);
    expect(errors).toHaveLength(0);
  });
});

describe('FindCatalogQueryDto.denomination (run_20261011_105146 criterion #1)', () => {
  it('normalises a single value into a one-element array', async () => {
    const { instance, errors } = await validateQuery({ denomination: 'Cent' });
    expect(instance.denomination).toEqual(['Cent']);
    expect(errors).toHaveLength(0);
  });

  it('keeps a repeated value (already an array) as the same two entries in order', async () => {
    const { instance, errors } = await validateQuery({ denomination: ['5 Kopiyok', '10 Hryvnias'] });
    expect(instance.denomination).toEqual(['5 Kopiyok', '10 Hryvnias']);
    expect(errors).toHaveLength(0);
  });

  it('leaves denomination undefined when the key is absent, with no validation errors', async () => {
    const { instance, errors } = await validateQuery({});
    expect(instance.denomination).toBeUndefined();
    expect(errors).toHaveLength(0);
  });

  it('rejects an array that contains a non-string entry', async () => {
    const { errors } = await validateQuery({ denomination: ['Cent', 5] });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('denomination');
  });
});

describe('FindCatalogQueryDto.keyDateOnly (run_20261011_105146 criterion #2)', () => {
  it('transforms "true" into the boolean true', async () => {
    const { instance, errors } = await validateQuery({ keyDateOnly: 'true' });
    expect(instance.keyDateOnly).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('transforms "false" into the boolean false', async () => {
    const { instance, errors } = await validateQuery({ keyDateOnly: 'false' });
    expect(instance.keyDateOnly).toBe(false);
    expect(errors).toHaveLength(0);
  });

  it('transforms any other string (e.g. "yes") into false', async () => {
    const { instance, errors } = await validateQuery({ keyDateOnly: 'yes' });
    expect(instance.keyDateOnly).toBe(false);
    expect(errors).toHaveLength(0);
  });

  it('leaves keyDateOnly undefined when absent', async () => {
    const { instance, errors } = await validateQuery({});
    expect(instance.keyDateOnly).toBeUndefined();
    expect(errors).toHaveLength(0);
  });
});

describe('FindCatalogQueryDto.hideOwned (run_20261011_105146 criterion #3)', () => {
  it('transforms "true" into the boolean true', async () => {
    const { instance, errors } = await validateQuery({ hideOwned: 'true' });
    expect(instance.hideOwned).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('transforms "false" into the boolean false', async () => {
    const { instance, errors } = await validateQuery({ hideOwned: 'false' });
    expect(instance.hideOwned).toBe(false);
    expect(errors).toHaveLength(0);
  });

  it('transforms any other string (e.g. "1") into false', async () => {
    const { instance, errors } = await validateQuery({ hideOwned: '1' });
    expect(instance.hideOwned).toBe(false);
    expect(errors).toHaveLength(0);
  });

  it('leaves hideOwned undefined when absent', async () => {
    const { instance, errors } = await validateQuery({});
    expect(instance.hideOwned).toBeUndefined();
    expect(errors).toHaveLength(0);
  });
});

describe('FindCatalogQueryDto.sort (run_20261011_105146 criterion #4)', () => {
  it('defaults to year_asc when absent', async () => {
    const { instance, errors } = await validateQuery({});
    expect(instance.sort).toBe('year_asc');
    expect(errors).toHaveLength(0);
  });

  it.each(['year_asc', 'year_desc', 'name_asc'])('accepts %s and keeps its value', async (sort) => {
    const { instance, errors } = await validateQuery({ sort });
    expect(instance.sort).toBe(sort);
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown value with exactly one error on the sort property', async () => {
    const { errors } = await validateQuery({ sort: 'bogus' });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('sort');
  });
});
