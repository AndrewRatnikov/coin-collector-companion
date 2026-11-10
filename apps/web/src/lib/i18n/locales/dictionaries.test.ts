/**
 * Tests for: locales/en, locales/es
 * Contract source: runs/run_20260726_221855/plan.md § Interface Contract → Module: locale dictionaries
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/lib/i18n/locales/dictionaries.test.ts
 *                   runs/run_20261110_062926/plan.md § Interface Contract → dictionaries.test.ts
 * Covers criteria: #1, #2, #5 (from prd.md), plus #6, #7 of run_20261110_062926
 *
 * Note: key-parity between en/es is also enforced at compile time, per area, by each
 * es/<area>.ts's `Record<keyof typeof en<Area>, string>` annotation and for the whole
 * dictionary by es/index.ts's `Record<MessageKey, string>`. This runtime
 * check is a redundant, independently-falsifiable guard against a build-time
 * regression (e.g. an `as any` cast slipping past the compiler).
 *
 * run_20260728_071525: nav.canonicalSets/nav.publicSets are updated to Title Case
 * ("Canonical Sets"/"Public Sets") per plan.md's Interface Contract for
 * dictionaries.test.ts — this is the only change to this file. Every other locked
 * assertion below stays byte-identical to the prior run.
 *
 * run_20261110_062926: the dictionaries are split into per-area files. Two tests are
 * added at the end (key-count sum, prefix placement); the existing assertions are untouched.
 */

import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/locales/en';
import enAccount from '@/lib/i18n/locales/en/account';
import enAddCoins from '@/lib/i18n/locales/en/add-coins';
import enBrowseSets from '@/lib/i18n/locales/en/browse-sets';
import enCatalog from '@/lib/i18n/locales/en/catalog';
import enCollection from '@/lib/i18n/locales/en/collection';
import enCommon from '@/lib/i18n/locales/en/common';
import enGlossary from '@/lib/i18n/locales/en/glossary';
import enGrades from '@/lib/i18n/locales/en/grades';
import enSetNew from '@/lib/i18n/locales/en/set-new';
import enSets from '@/lib/i18n/locales/en/sets';
import es from '@/lib/i18n/locales/es';
import esAccount from '@/lib/i18n/locales/es/account';
import esAddCoins from '@/lib/i18n/locales/es/add-coins';
import esBrowseSets from '@/lib/i18n/locales/es/browse-sets';
import esCatalog from '@/lib/i18n/locales/es/catalog';
import esCollection from '@/lib/i18n/locales/es/collection';
import esCommon from '@/lib/i18n/locales/es/common';
import esGlossary from '@/lib/i18n/locales/es/glossary';
import esGrades from '@/lib/i18n/locales/es/grades';
import esSetNew from '@/lib/i18n/locales/es/set-new';
import esSets from '@/lib/i18n/locales/es/sets';

const AREA_PREFIXES: Record<string, readonly string[]> = {
  common: ['nav', 'footer', 'languageSwitcher', 'home', 'common', 'ui'],
  account: ['login', 'signup', 'forgotPassword', 'resetPassword', 'settings'],
  catalog: ['catalog', 'coinDetail', 'submitCoinForm', 'submissionConfirmation', 'mySubmissions', 'admin'],
  sets: ['setPage', 'setEditor', 'setAlbum', 'setProgress', 'missingList'],
  'set-new': ['setNew'],
  'add-coins': ['addCoins'],
  'browse-sets': ['dashboard', 'publicSets', 'publicSetDetail', 'canonicalSets', 'canonicalSetDetail'],
  collection: ['collection', 'import'],
  grades: ['grade'],
  glossary: ['glossary'],
};

const EN_AREAS: Record<string, object> = {
  common: enCommon,
  account: enAccount,
  catalog: enCatalog,
  sets: enSets,
  'set-new': enSetNew,
  'add-coins': enAddCoins,
  'browse-sets': enBrowseSets,
  collection: enCollection,
  grades: enGrades,
  glossary: enGlossary,
};

const ES_AREAS: Record<string, object> = {
  common: esCommon,
  account: esAccount,
  catalog: esCatalog,
  sets: esSets,
  'set-new': esSetNew,
  'add-coins': esAddCoins,
  'browse-sets': esBrowseSets,
  collection: esCollection,
  grades: esGrades,
  glossary: esGlossary,
};

describe('locale dictionaries', () => {
  describe('criterion 2: en/es key parity', () => {
    it('has an identical key set in en and es', () => {
      expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    });

    it('has a non-empty string value for every key in both locales', () => {
      for (const key of Object.keys(en)) {
        expect(typeof en[key]).toBe('string');
        expect(en[key].length).toBeGreaterThan(0);
        expect(typeof es[key]).toBe('string');
        expect(es[key].length).toBeGreaterThan(0);
      }
    });
  });

  describe('criteria #1, #5: required keys from the Interface Contract exist', () => {
    it.each([
      'nav.catalog',
      'nav.canonicalSets',
      'nav.publicSets',
      'nav.dashboard',
      'nav.collection',
      'nav.logOut',
      'nav.logIn',
      'common.somethingWentWrong',
      'languageSwitcher.english',
      'languageSwitcher.spanish',
    ])('defines "%s" in en', (key) => {
      expect(en[key]).toBeDefined();
    });
  });

  describe('criterion 1: en values match the exact current UI copy (no behavior drift)', () => {
    it('keeps the nav labels byte-identical to the pre-i18n hardcoded strings', () => {
      expect(en['nav.catalog']).toBe('Catalog');
      expect(en['nav.canonicalSets']).toBe('Canonical Sets');
      expect(en['nav.publicSets']).toBe('Public Sets');
      expect(en['nav.dashboard']).toBe('Dashboard');
      expect(en['nav.collection']).toBe('Collection');
      expect(en['nav.logOut']).toBe('Log out');
      expect(en['nav.logIn']).toBe('Log in');
    });

    it('keeps the shared fallback error copy byte-identical to the pre-i18n hardcoded string', () => {
      expect(en['common.somethingWentWrong']).toBe('Something went wrong. Please try again.');
    });

    it('keeps the language switcher labels as plain English/Spanish names', () => {
      expect(en['languageSwitcher.english']).toBe('English');
      expect(en['languageSwitcher.spanish']).toBe('Spanish');
    });
  });

  describe('area files: no key is defined in two areas', () => {
    it.each([
      ['en', EN_AREAS, en],
      ['es', ES_AREAS, es],
    ] as const)('%s: area key counts sum to the merged key count', (_locale, areas, merged) => {
      const sum = Object.values(areas).reduce((total, area) => total + Object.keys(area).length, 0);
      expect(Object.keys(areas).sort()).toEqual(Object.keys(AREA_PREFIXES).sort());
      expect(Object.keys(merged).length).toBeGreaterThan(0);
      expect(sum).toBe(Object.keys(merged).length);
    });
  });

  describe('area files: every key sits in the area that owns its prefix', () => {
    it.each([
      ['en', EN_AREAS],
      ['es', ES_AREAS],
    ] as const)('%s: every key prefix is listed for its area', (_locale, areas) => {
      expect(Object.keys(areas).sort()).toEqual(Object.keys(AREA_PREFIXES).sort());
      for (const [area, dict] of Object.entries(areas)) {
        const keys = Object.keys(dict);
        expect(keys.length).toBeGreaterThan(0);
        const misplaced = keys.filter((key) => !AREA_PREFIXES[area].includes(key.split('.')[0]));
        expect(misplaced, `keys in ${area} with a prefix owned by another area`).toEqual([]);
      }
    });
  });
});
