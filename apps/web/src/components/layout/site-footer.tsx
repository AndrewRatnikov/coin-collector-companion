'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-context';

const footerLinkClassName = 'underline underline-offset-2 hover:text-[var(--color-accent)]';

// The footer is the last element on every page, so its extra 64px of bottom padding below
// 900px is what keeps page content clear of the fixed MobileTabBar.
export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer
      data-testid="site-footer"
      className="mt-auto border-t border-[var(--color-divider)] pb-[calc(1rem+64px)] text-[13px] text-[var(--color-neutral-700)] min-[900px]:pb-4"
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-2.5 px-4 pt-4 min-[900px]:px-10">
        <nav aria-label={t('footer.navLabel')} data-testid="site-footer-nav" className="flex flex-wrap gap-5">
          <Link href="/glossary" data-testid="site-footer-glossary-link" className={footerLinkClassName}>
            {t('nav.glossary')}
          </Link>
          <Link href="/settings/feedback" data-testid="site-footer-feedback-link" className={footerLinkClassName}>
            {t('footer.sendFeedback')}
          </Link>
        </nav>
        <p className="text-xs text-[var(--color-neutral-600)]">
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
        </p>
      </div>
    </footer>
  );
}
