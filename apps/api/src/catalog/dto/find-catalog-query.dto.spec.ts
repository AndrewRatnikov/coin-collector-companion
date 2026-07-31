/**
 * Tests for: FindCatalogQueryDto.submittedByMe
 * Contract source: runs/run_20260731_132040/plan.md § Interface Contract → DTO field: FindCatalogQueryDto.submittedByMe (MODIFY),
 *                   DTO test file: find-catalog-query.dto.spec.ts (CREATE)
 * Covers criteria: #1, #2, #3 (from prd.md)
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
