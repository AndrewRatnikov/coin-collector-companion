/**
 * Tests for: locale-cookie, LOCALES
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Locale: types and cookie helpers
 * Covers criteria: #5 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  isLocale,
  parseLocale,
  readLocaleCookie,
  writeLocaleCookie,
} from '@/lib/i18n/locale-cookie';
import { LOCALES, LOCALE_STORAGE_KEY } from '@/lib/i18n/types';

function clearCookie() {
  document.cookie = 'ccc-locale=; max-age=0; path=/';
}

describe('LOCALES', () => {
  it('lists en and es', () => {
    expect([...LOCALES]).toEqual(['en', 'es']);
    expect(LOCALE_STORAGE_KEY).toBe('ccc-locale');
  });
});

describe('cookie constants', () => {
  it('uses the storage key as the cookie name and a one-year max age', () => {
    expect(LOCALE_COOKIE_NAME).toBe('ccc-locale');
    expect(LOCALE_COOKIE_NAME).toBe(LOCALE_STORAGE_KEY);
    expect(LOCALE_COOKIE_MAX_AGE).toBe(31536000);
  });
});

describe('isLocale', () => {
  it('accepts exactly the supported locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('es')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('ES')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe('parseLocale', () => {
  it('returns the locale for a supported value', () => {
    expect(parseLocale('es')).toBe('es');
    expect(parseLocale('en')).toBe('en');
  });

  it('falls back to en for a missing or unknown value', () => {
    expect(parseLocale(undefined)).toBe('en');
    expect(parseLocale('')).toBe('en');
    expect(parseLocale('fr')).toBe('en');
    expect(parseLocale('ES')).toBe('en');
    expect(parseLocale('es-MX')).toBe('en');
  });
});

describe('readLocaleCookie', () => {
  beforeEach(clearCookie);
  afterEach(clearCookie);

  it('reads the locale out of a cookie string with other cookies around it', () => {
    expect(readLocaleCookie('a=b; ccc-locale=es; c=d')).toBe('es');
    expect(readLocaleCookie('ccc-locale=en')).toBe('en');
    expect(readLocaleCookie('theme=dark; ccc-locale=en')).toBe('en');
  });

  it('returns null when the cookie is absent', () => {
    expect(readLocaleCookie('')).toBeNull();
    expect(readLocaleCookie('a=b; c=d')).toBeNull();
  });

  it('returns null for an invalid value', () => {
    expect(readLocaleCookie('ccc-locale=fr')).toBeNull();
    expect(readLocaleCookie('ccc-locale=')).toBeNull();
  });

  it('does not match a cookie whose name only ends with ccc-locale', () => {
    expect(readLocaleCookie('xccc-locale=es')).toBeNull();
  });

  it('defaults to document.cookie', () => {
    expect(readLocaleCookie()).toBeNull();

    document.cookie = 'ccc-locale=es; path=/';
    expect(readLocaleCookie()).toBe('es');

    document.cookie = 'ccc-locale=en; path=/';
    expect(readLocaleCookie()).toBe('en');
  });
});

describe('writeLocaleCookie', () => {
  beforeEach(clearCookie);
  afterEach(() => {
    vi.restoreAllMocks();
    clearCookie();
  });

  it('assigns exactly the documented cookie string for es', () => {
    const setter = vi.spyOn(Document.prototype, 'cookie', 'set');

    writeLocaleCookie('es');

    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter.mock.calls[0][0]).toBe('ccc-locale=es; path=/; max-age=31536000; SameSite=Lax');
  });

  it('writes the locale it was given (en differs from es)', () => {
    const setter = vi.spyOn(Document.prototype, 'cookie', 'set');

    writeLocaleCookie('en');

    expect(setter.mock.calls[0][0]).toBe('ccc-locale=en; path=/; max-age=31536000; SameSite=Lax');
  });

  it('is not HttpOnly and not Secure', () => {
    const setter = vi.spyOn(Document.prototype, 'cookie', 'set');

    writeLocaleCookie('es');

    const written = String(setter.mock.calls[0][0]);
    expect(written).not.toMatch(/HttpOnly/i);
    expect(written).not.toMatch(/Secure/i);
  });

  it('round-trips through readLocaleCookie', () => {
    writeLocaleCookie('es');
    expect(readLocaleCookie()).toBe('es');

    writeLocaleCookie('en');
    expect(readLocaleCookie()).toBe('en');
  });
});
