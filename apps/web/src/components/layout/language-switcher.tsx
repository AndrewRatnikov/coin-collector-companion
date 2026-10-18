'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';
import type { Locale } from '@/lib/i18n/types';

const LOCALE_OPTIONS: {
  value: Locale;
  text: string;
  testId: string;
  labelKey: 'languageSwitcher.english' | 'languageSwitcher.spanish';
}[] = [
  { value: 'en', text: 'EN', testId: 'language-switcher-en', labelKey: 'languageSwitcher.english' },
  { value: 'es', text: 'ES', testId: 'language-switcher-es', labelKey: 'languageSwitcher.spanish' },
];

// Segmented EN/ES control (classical.css `.lang`): two toggle buttons, the current
// locale pressed.
export function LanguageSwitcher() {
  const { locale, t, setLocale } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('nav.languageLabel')}
      data-testid="language-switcher"
      className="inline-flex h-[30px] items-stretch overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-neutral-300)] text-xs font-medium"
    >
      {LOCALE_OPTIONS.map((option) => {
        const pressed = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-testid={option.testId}
            aria-label={t(option.labelKey)}
            aria-pressed={pressed}
            onClick={() => setLocale(option.value)}
            className={
              pressed
                ? 'bg-[var(--color-text)] px-2.5 text-white'
                : 'bg-transparent px-2.5 text-[var(--color-neutral-600)] transition-colors hover:text-[var(--color-text)]'
            }
          >
            {option.text}
          </button>
        );
      })}
    </div>
  );
}
