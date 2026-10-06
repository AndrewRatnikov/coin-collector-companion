/**
 * Tests for: column-mapping (HEADER_SYNONYMS, suggestMapping, parseMappingField)
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (Module: column-mapping.ts)
 *                   and § Column mapping (binding)
 * Covers criteria: #13 (from runs/run_20261005_212015/prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { IMPORT_FIELDS, isImportMappingComplete } from '@coin-collector/shared';
import { CsvImportError } from './csv-parser';
import { HEADER_SYNONYMS, parseMappingField, suggestMapping } from './column-mapping';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof CsvImportError ? err.code : `not-a-CsvImportError:${String(err)}`;
  }
  return undefined;
}

describe('HEADER_SYNONYMS', () => {
  it('has the documented synonym lists for every field', () => {
    expect(Object.keys(HEADER_SYNONYMS).sort()).toEqual([...IMPORT_FIELDS].sort());
    expect(HEADER_SYNONYMS.year).toEqual(expect.arrayContaining(['year', 'yr', 'date', 'year minted']));
    expect(HEADER_SYNONYMS.country).toEqual(
      expect.arrayContaining(['country', 'nation', 'issuer', 'issuing country']),
    );
    expect(HEADER_SYNONYMS.denomination).toEqual(
      expect.arrayContaining(['denomination', 'denom', 'face value', 'value', 'nominal']),
    );
    expect(HEADER_SYNONYMS.mintMark).toEqual(expect.arrayContaining(['mint mark', 'mintmark', 'mint', 'mm']));
    expect(HEADER_SYNONYMS.variety).toEqual(expect.arrayContaining(['variety', 'variant', 'var']));
    expect(HEADER_SYNONYMS.combined).toEqual(
      expect.arrayContaining(['coin', 'description', 'title', 'name', 'item']),
    );
  });
});

describe('suggestMapping', () => {
  it('maps the standard English headers to their column indexes', () => {
    expect(suggestMapping(['Year', 'Country', 'Denomination', 'Mint Mark', 'Variety'])).toEqual({
      year: 0,
      country: 1,
      denomination: 2,
      mintMark: 3,
      variety: 4,
    });
  });

  it('follows the column order of the file, not the field order', () => {
    expect(suggestMapping(['Variety', 'Denomination', 'Country', 'Year'])).toEqual({
      variety: 0,
      denomination: 1,
      country: 2,
      year: 3,
    });
  });

  it('ignores case, surrounding whitespace and collapses inner whitespace', () => {
    expect(suggestMapping(['  YEAR  ', 'cOuNtRy', 'Mint    Mark'])).toEqual({
      year: 0,
      country: 1,
      mintMark: 2,
    });
  });

  it('treats underscore, hyphen and dot as spaces', () => {
    expect(suggestMapping(['mint_mark', 'face-value', 'year.minted', 'issuing_country'])).toEqual({
      mintMark: 0,
      denomination: 1,
      year: 2,
      country: 3,
    });
  });

  it('recognises the other documented synonyms', () => {
    expect(suggestMapping(['Yr', 'Nation', 'Denom', 'MM', 'Variant'])).toEqual({
      year: 0,
      country: 1,
      denomination: 2,
      mintMark: 3,
      variety: 4,
    });
    expect(suggestMapping(['Coin', 'Issuer', 'Nominal'])).toEqual({ combined: 0, country: 1, denomination: 2 });
  });

  it('ignores unknown headers, which keep their column index free', () => {
    expect(suggestMapping(['Price', 'Year', 'Grade', 'Country', 'Notes', 'Denomination'])).toEqual({
      year: 1,
      country: 3,
      denomination: 5,
    });
  });

  it('assigns each field only once: the first matching header wins, a later synonym is ignored', () => {
    expect(suggestMapping(['Year', 'Date', 'Country', 'Denomination'])).toEqual({
      year: 0,
      country: 2,
      denomination: 3,
    });
    expect(suggestMapping(['Mint', 'Mint Mark', 'Year'])).toEqual({ mintMark: 0, year: 2 });
  });

  it('returns an empty mapping when nothing matches', () => {
    expect(suggestMapping(['foo', 'bar'])).toEqual({});
    expect(suggestMapping([])).toEqual({});
  });

  it('produces a mapping that isImportMappingComplete accepts for a typical file and rejects otherwise', () => {
    expect(isImportMappingComplete(suggestMapping(['Year', 'Country', 'Denomination']))).toBe(true);
    expect(isImportMappingComplete(suggestMapping(['Coin', 'Country', 'Denomination']))).toBe(true);
    expect(isImportMappingComplete(suggestMapping(['Year', 'Country']))).toBe(false);
  });
});

describe('parseMappingField', () => {
  it('returns null for undefined and the empty string (caller falls back to suggestMapping)', () => {
    expect(parseMappingField(undefined, 5)).toBeNull();
    expect(parseMappingField('', 5)).toBeNull();
  });

  it('parses a valid JSON object of field -> column index', () => {
    expect(parseMappingField('{"year":0,"country":1,"denomination":2}', 3)).toEqual({
      year: 0,
      country: 1,
      denomination: 2,
    });
    expect(parseMappingField('{"year":2,"country":0,"denomination":1,"mintMark":4}', 5)).toEqual({
      year: 2,
      country: 0,
      denomination: 1,
      mintMark: 4,
    });
  });

  it('omits null values from the result (null = unmapped)', () => {
    const result = parseMappingField('{"year":0,"country":1,"denomination":2,"mintMark":null}', 3);
    expect(result).toEqual({ year: 0, country: 1, denomination: 2 });
    expect(result).not.toHaveProperty('mintMark');
  });

  it('accepts the combined field', () => {
    expect(parseMappingField('{"combined":0,"country":1,"denomination":2}', 3)).toEqual({
      combined: 0,
      country: 1,
      denomination: 2,
    });
  });

  it('accepts an empty object', () => {
    expect(parseMappingField('{}', 3)).toEqual({});
  });

  it.each([
    ['not JSON', 'year=0'],
    ['truncated JSON', '{"year":'],
    ['a JSON array', '[0,1]'],
    ['a JSON string', '"year"'],
    ['a JSON number', '5'],
    ['JSON null', 'null'],
    ['an unknown field key', '{"price":0}'],
    ['a string index', '{"year":"0"}'],
    ['a fractional index', '{"year":0.5}'],
    ['a negative index', '{"year":-1}'],
    ['an index equal to columnCount', '{"year":3}'],
    ['an index above columnCount', '{"year":99}'],
    ['a boolean value', '{"year":true}'],
    ['the same column used twice', '{"year":0,"country":0}'],
  ])('rejects %s with IMPORT_INVALID_MAPPING', (_label, raw) => {
    expect(codeOf(() => parseMappingField(raw, 3))).toBe('IMPORT_INVALID_MAPPING');
  });

  it('checks the index bound against columnCount (boundary)', () => {
    expect(parseMappingField('{"year":2}', 3)).toEqual({ year: 2 });
    expect(codeOf(() => parseMappingField('{"year":2}', 2))).toBe('IMPORT_INVALID_MAPPING');
  });

  it('allows several unmapped (null) fields even though they share the value null', () => {
    expect(parseMappingField('{"year":0,"mintMark":null,"variety":null}', 1)).toEqual({ year: 0 });
  });
});
