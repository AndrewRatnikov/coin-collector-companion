/**
 * Tests for: locales/en, locales/es
 * Contract source: runs/run_20260726_221855/plan.md § Interface Contract → Module: locale dictionaries
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/lib/i18n/locales/dictionaries.test.ts
 *                   runs/run_20261110_062926/plan.md § Interface Contract → dictionaries.test.ts
 *                   runs/run_20261117_063301/plan.md § Interface Contract → Locale files
 *                   runs/run_20261120_215525/plan.md § Interface Contract → Locale files
 *                   runs/run_20261120_225014/plan.md § Interface Contract → i18n
 * Covers criteria: #1, #2, #5 (from prd.md), plus #6, #7 of run_20261110_062926
 *                  and #3, #19 of run_20261117_063301, and #15 of run_20261120_215525,
 *                  and #14 of run_20261120_225014
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
 *
 * run_20261112_212821: 'notFound' is added to the common area's allowed prefixes (the only change).
 *
 * run_20261117_063301: the landing area is added (AREA_PREFIXES, EN_AREAS, ES_AREAS), and a new block
 * covers common.serverWaking, the removed landing.waking and the removed home.* keys. Existing
 * assertions are untouched.
 *
 * run_20261120_215525: the want-list area is added (AREA_PREFIXES, EN_AREAS, ES_AREAS) and a new block
 * pins its keys, copy and placeholders. Existing assertions are untouched.
 *
 * run_20261120_225014: the privacy area is added (AREA_PREFIXES, EN_AREAS, ES_AREAS) and a new block
 * pins its eight keys, the footer.privacy key and the copy. Existing assertions are untouched.
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
import enLanding from '@/lib/i18n/locales/en/landing';
import enPrivacy from '@/lib/i18n/locales/en/privacy';
import enSetNew from '@/lib/i18n/locales/en/set-new';
import enSets from '@/lib/i18n/locales/en/sets';
import enWantList from '@/lib/i18n/locales/en/want-list';
import es from '@/lib/i18n/locales/es';
import esAccount from '@/lib/i18n/locales/es/account';
import esAddCoins from '@/lib/i18n/locales/es/add-coins';
import esBrowseSets from '@/lib/i18n/locales/es/browse-sets';
import esCatalog from '@/lib/i18n/locales/es/catalog';
import esCollection from '@/lib/i18n/locales/es/collection';
import esCommon from '@/lib/i18n/locales/es/common';
import esGlossary from '@/lib/i18n/locales/es/glossary';
import esGrades from '@/lib/i18n/locales/es/grades';
import esLanding from '@/lib/i18n/locales/es/landing';
import esPrivacy from '@/lib/i18n/locales/es/privacy';
import esSetNew from '@/lib/i18n/locales/es/set-new';
import esSets from '@/lib/i18n/locales/es/sets';
import esWantList from '@/lib/i18n/locales/es/want-list';

const AREA_PREFIXES: Record<string, readonly string[]> = {
  common: ['nav', 'footer', 'languageSwitcher', 'home', 'common', 'ui', 'notFound'],
  account: ['login', 'signup', 'forgotPassword', 'resetPassword', 'settings'],
  catalog: ['catalog', 'coinDetail', 'submitCoinForm', 'submissionConfirmation', 'mySubmissions', 'admin'],
  sets: ['setPage', 'setEditor', 'setAlbum', 'setProgress', 'missingList'],
  'set-new': ['setNew'],
  'add-coins': ['addCoins'],
  'browse-sets': ['dashboard', 'publicSets', 'publicSetDetail', 'canonicalSets', 'canonicalSetDetail'],
  collection: ['collection', 'import'],
  grades: ['grade'],
  glossary: ['glossary'],
  landing: ['landing'],
  'want-list': ['wantList'],
  privacy: ['privacy'],
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
  landing: enLanding,
  'want-list': enWantList,
  privacy: enPrivacy,
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
  landing: esLanding,
  'want-list': esWantList,
  privacy: esPrivacy,
};

function placeholders(text: string): string[] {
  return (text.match(/\{[A-Za-z]+\}/g) ?? []).sort();
}

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

  describe('run_20261117_063301 criterion 3: common.serverWaking replaces landing.waking', () => {
    it('defines common.serverWaking with the exact EN and ES text', () => {
      expect(en['common.serverWaking']).toBe('Waking the server. This can take up to a minute on the first visit.');
      expect(es['common.serverWaking']).toBe(
        'Despertando el servidor. En la primera visita puede tardar hasta un minuto.',
      );
    });

    it('keeps common.serverWaking in the common area files', () => {
      expect((enCommon as Record<string, string>)['common.serverWaking']).toBe(en['common.serverWaking']);
      expect((esCommon as Record<string, string>)['common.serverWaking']).toBe(es['common.serverWaking']);
    });

    it('does not define landing.waking in either locale or in the landing files', () => {
      expect(en['landing.waking']).toBeUndefined();
      expect(es['landing.waking']).toBeUndefined();
      expect(Object.keys(enLanding)).not.toContain('landing.waking');
      expect(Object.keys(esLanding)).not.toContain('landing.waking');
    });
  });

  describe('run_20261117_063301 criterion 19: landing area and home.* cleanup', () => {
    it('has the same landing keys in en and es', () => {
      expect(Object.keys(esLanding).sort()).toEqual(Object.keys(enLanding).sort());
      expect(Object.keys(enLanding).length).toBeGreaterThan(50);
    });

    it('uses the same {placeholders} in en and es for every landing key', () => {
      const enMap = enLanding as Record<string, string>;
      const esMap = esLanding as Record<string, string>;
      for (const key of Object.keys(enMap)) {
        expect(placeholders(esMap[key]), `placeholders of ${key}`).toEqual(placeholders(enMap[key]));
      }
    });

    it('merges the landing area into the full dictionaries with the brief copy', () => {
      expect(en['landing.headline']).toBe('See what you’re still missing.');
      expect(en['landing.ctaPrimary']).toBe('Create a free account');
      expect(en['landing.ctaSecondary']).toBe('Browse checklists');
      expect(en['landing.metaDescription']).toBe(
        'Free checklists for coin collectors. Mark what you own and see what you’re still missing.',
      );
      expect(es['landing.headline']).not.toBe(en['landing.headline']);
    });

    it('keeps home.accountDeletedNotice and drops the keys the old home page used', () => {
      expect(en['home.accountDeletedNotice']).toBeDefined();
      expect(es['home.accountDeletedNotice']).toBeDefined();
      for (const key of [
        'home.title',
        'home.eyebrow',
        'home.headline',
        'home.paragraph',
        'home.browseCatalogue',
        'home.browseCanonical',
        'home.browsePublic',
        'home.coinsUnit',
        'home.setsUnit',
      ]) {
        expect(en[key], `en ${key}`).toBeUndefined();
        expect(es[key], `es ${key}`).toBeUndefined();
      }
    });

    it('never claims a catalogue size in thousands', () => {
      for (const [key, value] of Object.entries(en)) {
        expect(value, key).not.toMatch(/thousands of coins/i);
      }
      for (const [key, value] of Object.entries(es)) {
        expect(value, key).not.toMatch(/miles de monedas/i);
      }
    });
  });

  describe('run_20261120_215525 criterion 15: want-list area', () => {
    const KEYS = [
      'wantList.title',
      'wantList.subtitle',
      'wantList.printButton',
      'wantList.downloadCsv',
      'wantList.sectionMissing',
      'wantList.sectionUpgrade',
      'wantList.upgradeNote',
      'wantList.nothingMissing',
      'wantList.nothingWanted',
      'wantList.plain',
      'wantList.keyLegend',
      'wantList.whichSets',
      'wantList.loadingLabel',
      'wantList.errorTitle',
      'wantList.errorBody',
      'wantList.retry',
      'wantList.noSets',
      'wantList.newSetLink',
      'wantList.allSetsLink',
    ];

    it('has exactly the contract keys in both want-list files', () => {
      expect(Object.keys(enWantList).sort()).toEqual([...KEYS].sort());
      expect(Object.keys(esWantList).sort()).toEqual([...KEYS].sort());
    });

    it('merges every want-list key into the full dictionaries', () => {
      for (const key of KEYS) {
        expect(en[key], `en ${key}`).toBe((enWantList as Record<string, string>)[key]);
        expect(es[key], `es ${key}`).toBe((esWantList as Record<string, string>)[key]);
      }
    });

    it('uses the same {placeholders} in en and es for every want-list key', () => {
      const enMap = enWantList as Record<string, string>;
      const esMap = esWantList as Record<string, string>;
      for (const key of KEYS) {
        expect(placeholders(esMap[key]), `placeholders of ${key}`).toEqual(placeholders(enMap[key]));
      }
      expect(placeholders(enMap['wantList.subtitle'])).toEqual(['{k}', '{m}', '{n}']);
    });

    it('has the exact EN copy of the page text the tests and the backlog rely on', () => {
      expect(en['wantList.title']).toBe('Want list');
      expect(en['wantList.subtitle']).toBe('Across your {n} sets · {m} missing · {k} to upgrade');
      expect(en['wantList.nothingWanted']).toBe('Nothing missing across your sets.');
      expect(en['wantList.whichSets']).toBe('Which sets?');
      expect(en['wantList.allSetsLink']).toBe('Want list for all your sets');
      expect(en['wantList.newSetLink']).toBe('Create a set');
    });

    it('translates the want-list copy into Spanish', () => {
      expect(es['wantList.title']).toBe('Lista de faltantes');
      expect(es['wantList.whichSets']).toBe('¿Qué colecciones?');
      for (const key of ['wantList.title', 'wantList.whichSets', 'wantList.nothingWanted', 'wantList.noSets']) {
        expect(es[key], key).not.toBe(en[key]);
      }
    });
  });

  describe('run_20261120_225014 criterion 14: privacy area', () => {
    const KEYS = [
      'privacy.title',
      'privacy.intro',
      'privacy.storedHeading',
      'privacy.storedBody',
      'privacy.errorsHeading',
      'privacy.errorsBody',
      'privacy.analyticsHeading',
      'privacy.analyticsBody',
    ];

    it('has exactly the eight contract keys in both privacy files', () => {
      expect(Object.keys(enPrivacy).sort()).toEqual([...KEYS].sort());
      expect(Object.keys(esPrivacy).sort()).toEqual([...KEYS].sort());
    });

    it('merges every privacy key into the full dictionaries', () => {
      for (const key of KEYS) {
        expect(en[key], `en ${key}`).toBe((enPrivacy as Record<string, string>)[key]);
        expect(es[key], `es ${key}`).toBe((esPrivacy as Record<string, string>)[key]);
      }
    });

    it('has the exact EN headings and a Spanish translation that differs from them', () => {
      expect(en['privacy.title']).toBe('Privacy');
      expect(en['privacy.storedHeading']).toBe('What the app stores');
      expect(en['privacy.errorsHeading']).toBe('Error reports');
      expect(en['privacy.analyticsHeading']).toBe('Visit counts');
      expect(es['privacy.title']).toBe('Privacidad');
      expect(es['privacy.storedHeading']).toBe('Qué guarda la app');
      for (const key of KEYS) {
        expect(es[key], key).not.toBe(en[key]);
      }
    });

    it('names Sentry and PostHog and says no cookies in the right sections', () => {
      expect(en['privacy.errorsBody']).toContain('Sentry');
      expect(en['privacy.analyticsBody']).toContain('PostHog');
      expect(en['privacy.analyticsBody']).toContain('cookies');
      expect(es['privacy.errorsBody']).toContain('Sentry');
      expect(es['privacy.analyticsBody']).toContain('PostHog');
      expect(es['privacy.analyticsBody']).toContain('cookies');
    });

    it('defines footer.privacy in the common area, EN and ES', () => {
      expect(en['footer.privacy']).toBe('Privacy');
      expect(es['footer.privacy']).toBe('Privacidad');
      expect((enCommon as Record<string, string>)['footer.privacy']).toBe('Privacy');
      expect((esCommon as Record<string, string>)['footer.privacy']).toBe('Privacidad');
    });
  });
});
