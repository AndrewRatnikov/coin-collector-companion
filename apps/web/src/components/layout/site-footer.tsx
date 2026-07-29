'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="mt-auto border-t border-[var(--color-divider)] py-4 text-center text-xs text-[var(--color-neutral-600)]">
      {t('footer.attributionPrefix')}{' '}
      <a
        href="https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-[var(--color-accent)]"
      >
        {t('footer.wikipediaLinkText')}
      </a>
      {t('footer.attributionSuffix')}
    </footer>
  );
}
