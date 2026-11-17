import { LOCALES, LOCALE_STORAGE_KEY, type Locale } from './types';

// Shared by the server root layout (which reads the cookie with `cookies()`)
// and the client provider (which writes it). No 'use client' and no
// module-level `window`/`document` access, so the server can import it.

export const LOCALE_COOKIE_NAME = LOCALE_STORAGE_KEY;

/** One year, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 31536000;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** The locale named by a cookie value; 'en' when it is missing or unknown. */
export function parseLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : 'en';
}

/** The locale stored in the cookie, or null when the cookie is absent or invalid. */
export function readLocaleCookie(cookieString: string = document.cookie): Locale | null {
  for (const part of cookieString.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== LOCALE_COOKIE_NAME) continue;
    const value = part.slice(eq + 1).trim();
    return isLocale(value) ? value : null;
  }
  return null;
}

export function writeLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}
