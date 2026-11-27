/**
 * Tests for: catalog-view URL helpers (apps/web/src/lib/catalog-view.ts)
 * Contract source: runs/run_20261127_133045/plan.md § Interface Contract → Module: catalog-view (MODIFY)
 * Covers criteria: #11, #12, #13 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import type { CatalogFilters } from '@/lib/catalog-api';
import {
  catalogFiltersToQueryString,
  catalogSearchParamsFromRecord,
  catalogViewStateToFilters,
  EMPTY_CATALOG_VIEW_STATE,
  isPlainCatalogView,
  parseCatalogSearchParams,
} from '@/lib/catalog-view';

describe('catalogFiltersToQueryString', () => {
  it('is empty for no filters', () => {
    expect(catalogFiltersToQueryString({})).toBe('');
  });

  it('writes page and limit first, without a leading ?', () => {
    expect(catalogFiltersToQueryString({ page: 1, limit: 20 })).toBe('page=1&limit=20');
    expect(catalogFiltersToQueryString({ page: 3, limit: 20 })).toBe('page=3&limit=20');
  });

  it('matches the default view state filters', () => {
    expect(catalogFiltersToQueryString(catalogViewStateToFilters(EMPTY_CATALOG_VIEW_STATE, false))).toBe(
      'page=1&limit=20',
    );
  });

  it('walks the filters in insertion order and repeats array values', () => {
    const filters: CatalogFilters = {
      page: 3,
      limit: 20,
      country: 'USA',
      denomination: ['1 Cent', '5 Cents'],
      name: 'lincoln',
      yearMin: 1900,
      yearMax: 1950,
      keyDateOnly: true,
      sort: 'year_desc',
    };
    expect(catalogFiltersToQueryString(filters)).toBe(
      'page=3&limit=20&country=USA&denomination=1+Cent&denomination=5+Cents&name=lincoln&yearMin=1900&yearMax=1950&keyDateOnly=true&sort=year_desc',
    );
  });

  it('follows the insertion order (a different order gives a different string)', () => {
    expect(catalogFiltersToQueryString({ country: 'USA', page: 2 })).toBe('country=USA&page=2');
    expect(catalogFiltersToQueryString({ page: 2, country: 'USA' })).toBe('page=2&country=USA');
  });

  it('skips undefined and empty-string values, including empty array entries', () => {
    expect(catalogFiltersToQueryString({ page: 1, country: undefined, name: '' })).toBe('page=1');
    expect(catalogFiltersToQueryString({ page: 1, denomination: ['', '1 Cent'] })).toBe(
      'page=1&denomination=1+Cent',
    );
  });

  it('writes other falsy values as strings', () => {
    expect(catalogFiltersToQueryString({ keyDateOnly: false })).toBe('keyDateOnly=false');
  });

  it('encodes special characters', () => {
    expect(catalogFiltersToQueryString({ name: 'a b&c' })).toBe('name=a+b%26c');
  });

  it('writes hideOwned only when the filters carry it', () => {
    expect(catalogFiltersToQueryString(catalogViewStateToFilters({ ...EMPTY_CATALOG_VIEW_STATE, hideOwned: true }, true))).toBe(
      'page=1&limit=20&hideOwned=true',
    );
    expect(catalogFiltersToQueryString(catalogViewStateToFilters({ ...EMPTY_CATALOG_VIEW_STATE, hideOwned: true }, false))).toBe(
      'page=1&limit=20',
    );
  });
});

describe('catalogSearchParamsFromRecord', () => {
  it('turns an empty record into empty params', () => {
    expect(catalogSearchParamsFromRecord({}).toString()).toBe('');
  });

  it('appends strings', () => {
    const params = catalogSearchParamsFromRecord({ country: 'USA', page: '2' });
    expect(params.get('country')).toBe('USA');
    expect(params.get('page')).toBe('2');
  });

  it('appends every element of an array value, in order', () => {
    const params = catalogSearchParamsFromRecord({ denomination: ['1 Cent', '5 Cents'] });
    expect(params.getAll('denomination')).toEqual(['1 Cent', '5 Cents']);
  });

  it('skips undefined values and adds nothing for an empty array', () => {
    const params = catalogSearchParamsFromRecord({ country: undefined, denomination: [], name: 'wheat' });
    expect(params.has('country')).toBe(false);
    expect(params.has('denomination')).toBe(false);
    expect(params.get('name')).toBe('wheat');
  });

  it('keeps an empty string value', () => {
    expect(catalogSearchParamsFromRecord({ country: '' }).get('country')).toBe('');
  });

  it('feeds parseCatalogSearchParams like a URL query would', () => {
    const state = parseCatalogSearchParams(
      catalogSearchParamsFromRecord({ country: 'USA', denomination: ['1 Cent', '5 Cents'], page: '3' }),
    );
    expect(state).toMatchObject({ country: 'USA', denominations: ['1 Cent', '5 Cents'], page: 3 });
  });
});

describe('isPlainCatalogView', () => {
  it('is true for the empty state', () => {
    expect(isPlainCatalogView(EMPTY_CATALOG_VIEW_STATE)).toBe(true);
  });

  it.each([
    [''],
    ['utm_source=x'],
    ['sort=bogus'],
    ['page=1'],
    ['page=0'],
    ['page=abc'],
    ['sort=year_asc'],
    ['country='],
    ['name=%20%20'],
  ])('is true for ?%s (the parsed state equals the default)', (query) => {
    expect(isPlainCatalogView(parseCatalogSearchParams(new URLSearchParams(query)))).toBe(true);
  });

  it.each([
    ['country=USA'],
    ['denomination=1+Cent'],
    ['name=wheat'],
    ['yearMin=1900'],
    ['yearMax=1950'],
    ['keyDateOnly=true'],
    ['hideOwned=true'],
    ['sort=year_desc'],
    ['sort=name_asc'],
    ['page=2'],
    ['utm_source=x&page=2'],
  ])('is false for ?%s', (query) => {
    expect(isPlainCatalogView(parseCatalogSearchParams(new URLSearchParams(query)))).toBe(false);
  });

  it('is false for a state that differs from the empty state in one field', () => {
    expect(isPlainCatalogView({ ...EMPTY_CATALOG_VIEW_STATE, country: 'USA' })).toBe(false);
    expect(isPlainCatalogView({ ...EMPTY_CATALOG_VIEW_STATE, page: 2 })).toBe(false);
  });
});
