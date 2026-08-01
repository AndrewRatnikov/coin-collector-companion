'use client';

import { GLOSSARY_TERMS } from '@/lib/glossary-terms';
import { useTranslation } from '@/lib/i18n/i18n-context';

export default function GlossaryPage() {
  const { t } = useTranslation();

  const appTerms = GLOSSARY_TERMS.filter((entry) => entry.tier === 'app');
  const generalTerms = GLOSSARY_TERMS.filter((entry) => entry.tier === 'general');

  return (
    <main
      data-testid="glossary-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-8 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
    >
      <h1 className="text-[28px] font-normal leading-tight [font-family:var(--font-heading)]">
        {t('glossary.pageTitle')}
      </h1>

      <p data-testid="glossary-intro" className="max-w-[60ch] text-[15px] leading-relaxed text-[var(--color-neutral-700)]">
        {t('glossary.intro')}
      </p>

      <section className="flex flex-col gap-4">
        <h2
          data-testid="glossary-app-terms-heading"
          className="text-[19px] font-normal [font-family:var(--font-heading)]"
        >
          {t('glossary.appTermsHeading')}
        </h2>
        <ul data-testid="glossary-app-terms-list" className="flex flex-col border-t border-[var(--color-divider)]">
          {appTerms.map((entry) => (
            <li
              key={entry.id}
              data-testid="glossary-term"
              className="flex flex-col gap-1 border-b border-[var(--color-divider)] py-4"
            >
              <span data-testid="glossary-term-label" className="text-[16px] font-medium [font-family:var(--font-heading)]">
                {t(entry.termKey)}
              </span>
              <p data-testid="glossary-term-definition" className="text-[14px] leading-relaxed text-[var(--color-neutral-700)]">
                {t(entry.definitionKey)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2
          data-testid="glossary-general-terms-heading"
          className="text-[19px] font-normal [font-family:var(--font-heading)]"
        >
          {t('glossary.generalTermsHeading')}
        </h2>
        <ul data-testid="glossary-general-terms-list" className="flex flex-col border-t border-[var(--color-divider)]">
          {generalTerms.map((entry) => (
            <li
              key={entry.id}
              data-testid="glossary-term"
              className="flex flex-col gap-1 border-b border-[var(--color-divider)] py-4"
            >
              <span data-testid="glossary-term-label" className="text-[16px] font-medium [font-family:var(--font-heading)]">
                {t(entry.termKey)}
              </span>
              <p data-testid="glossary-term-definition" className="text-[14px] leading-relaxed text-[var(--color-neutral-700)]">
                {t(entry.definitionKey)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
