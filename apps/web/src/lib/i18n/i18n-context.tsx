'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import en from './locales/en';
import es from './locales/es';
import type { MessageKey } from './locales/en';
import { LOCALE_STORAGE_KEY, type Locale } from './types';

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, es };

interface I18nContextValue {
  locale: Locale;
  t: (key: MessageKey) => string;
  setLocale: (locale: Locale) => void;
}

// A working English default (not `createContext(undefined)`) so `useTranslation()`
// renders correctly even with no `<I18nProvider>` ancestor — every existing test
// in the repo renders pages/components directly with no wrapper, and this default
// is what keeps that behavior (and their text assertions) unchanged.
const defaultContextValue: I18nContextValue = {
  locale: 'en',
  t: (key) => en[key],
  setLocale: () => {},
};

const I18nContext = createContext<I18nContextValue>(defaultContextValue);

export function useTranslation(): I18nContextValue {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Initial render is always 'en' on both server and client so hydration never
  // mismatches; a stored preference (if any) is applied a moment after mount.
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'en' || stored === 'es') {
      setLocaleState(stored);
    }
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }

  const value: I18nContextValue = {
    locale,
    t: (key) => dictionaries[locale][key],
    setLocale,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
