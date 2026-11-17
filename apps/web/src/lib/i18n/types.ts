export const LOCALES = ['en', 'es'] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_STORAGE_KEY = 'ccc-locale';
