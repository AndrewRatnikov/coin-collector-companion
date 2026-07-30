'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';
import type { Locale } from '@/lib/i18n/types';

const LOCALE_OPTIONS: { value: Locale; labelKey: 'languageSwitcher.english' | 'languageSwitcher.spanish' }[] = [
  { value: 'en', labelKey: 'languageSwitcher.english' },
  { value: 'es', labelKey: 'languageSwitcher.spanish' },
];

export function LanguageSwitcher() {
  const { locale, t, setLocale } = useTranslation();

  return (
    <div data-testid="language-switcher" className="relative flex items-center text-xs">
      <select
        data-testid="language-switcher-select"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-label={t(LOCALE_OPTIONS.find((option) => option.value === locale)?.labelKey ?? 'languageSwitcher.english')}
        className="w-12 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-divider)] bg-[var(--color-bg)] px-2 py-1 text-transparent"
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="text-[var(--color-text)]">
            {t(option.labelKey)}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center px-2 text-[var(--color-neutral-600)]">
        {locale.toUpperCase()}
      </span>
    </div>
  );
}
