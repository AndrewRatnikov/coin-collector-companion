/**
 * Tests for: locales/en, locales/es
 * Contract source: runs/run_20260726_221855/plan.md § Interface Contract → Module: locale dictionaries
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/lib/i18n/locales/dictionaries.test.ts
 * Covers criteria: #1, #2, #5 (from prd.md)
 *
 * Note: key-parity between en/es is also enforced at compile time by es.ts's
 * `Record<MessageKey, string>` annotation (see plan.md § Approach 1). This runtime
 * check is a redundant, independently-falsifiable guard against a build-time
 * regression (e.g. an `as any` cast slipping past the compiler).
 *
 * run_20260728_071525: nav.canonicalSets/nav.publicSets are updated to Title Case
 * ("Canonical Sets"/"Public Sets") per plan.md's Interface Contract for
 * dictionaries.test.ts — this is the only change to this file. Every other locked
 * assertion below stays byte-identical to the prior run.
 */

import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';

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
});
