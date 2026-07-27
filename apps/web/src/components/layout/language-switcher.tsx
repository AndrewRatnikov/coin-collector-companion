'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';

export function LanguageSwitcher() {
  const { locale, t, setLocale } = useTranslation();

  return (
    <div data-testid="language-switcher" className="flex items-center gap-1 text-xs">
      <button
        type="button"
        data-testid="language-switcher-en"
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
        className={`rounded px-2 py-1 ${locale === 'en' ? 'font-semibold underline' : ''}`}
      >
        {t('languageSwitcher.english')}
      </button>
      <button
        type="button"
        data-testid="language-switcher-es"
        aria-pressed={locale === 'es'}
        onClick={() => setLocale('es')}
        className={`rounded px-2 py-1 ${locale === 'es' ? 'font-semibold underline' : ''}`}
      >
        {t('languageSwitcher.spanish')}
      </button>
    </div>
  );
}
