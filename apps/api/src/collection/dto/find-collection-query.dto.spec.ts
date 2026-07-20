/**
 * Tests for: FindCollectionQueryDto
 * Contract source: runs/run_20260720_142942/plan.md § Interface Contract (DTO: FindCollectionQueryDto)
 * Covers criteria: #7 (from runs/run_20260720_142942/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator/class-transformer decorators declared on
 * FindCollectionQueryDto. plainToInstance is required so @Type(() => Number) actually
 * coerces the string 'year' value NestJS's ValidationPipe would receive from a real query
 * string before @IsInt() validates it — matching apps/api/src/catalog/dto/find-catalog-query.dto.spec.ts's
 * established pattern for the sibling FindCatalogQueryDto (yearMin/yearMax).
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindCollectionQueryDto } from './find-collection-query.dto';

async function validateQuery(query: unknown) {
  const instance = plainToInstance(FindCollectionQueryDto, query);
  return { instance, errors: await validate(instance) };
}

describe('FindCollectionQueryDto (criterion #7)', () => {
  it('passes with no fields (both optional)', async () => {
    const { errors } = await validateQuery({});
    expect(errors).toHaveLength(0);
  });

  it('passes with only country', async () => {
    const { errors } = await validateQuery({ country: 'USA' });
    expect(errors).toHaveLength(0);
  });

  it('passes with only year (as a query-string number)', async () => {
    const { instance, errors } = await validateQuery({ year: '1943' });
    expect(errors).toHaveLength(0);
    expect(instance.year).toBe(1943);
  });

  it('passes with both country and year', async () => {
    const { errors } = await validateQuery({ country: 'USA', year: '1943' });
    expect(errors).toHaveLength(0);
  });

  it('fails when year is not a number', async () => {
    const { errors } = await validateQuery({ year: 'not-a-number' });
    expect(errors.some((e) => e.property === 'year')).toBe(true);
  });
});
