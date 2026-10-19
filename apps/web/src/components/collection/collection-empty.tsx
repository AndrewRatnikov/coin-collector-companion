'use client';

import Link from 'next/link';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import { useTranslation } from '@/lib/i18n/i18n-context';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

/** /collection with no coins: the My sets empty pattern, with Go to My sets and Import from CSV. */
export function CollectionEmpty() {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="collection-empty-title"
      className="flex flex-col gap-[22px] rounded-[var(--radius-lg)] border border-neutral-300 bg-white p-[clamp(20px,4vw,36px)]"
    >
      <div className="flex flex-wrap items-center gap-7">
        <div aria-hidden="true" className="flex flex-none">
          <PlaceholderCoin denomination="10 Hryvnias" material="Brass" size={72} />
          <PlaceholderCoin denomination="1 Cent" material="Copper" size={72} missing className="-ml-[18px]" />
          <PlaceholderCoin denomination="5 Kopiyok" material="Steel" size={72} className="-ml-[18px]" />
        </div>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <h2
            id="collection-empty-title"
            data-testid="collection-empty-title"
            className="font-heading text-[32px] leading-[1.1] font-semibold text-text"
          >
            {t('collection.emptyTitle')}
          </h2>
          <p className="max-w-[560px] text-[15px] text-neutral-800">{t('collection.emptyBody')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            data-testid="collection-empty-primary"
            href="/dashboard"
            className={`inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-accent-700 px-[18px] text-[15px] font-medium text-white hover:bg-accent-800 ${FOCUS_RING}`}
          >
            {t('collection.emptyPrimaryCta')}
          </Link>
          <Link
            data-testid="collection-empty-import"
            href="/collection/import"
            className={`inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] border border-neutral-400 bg-white px-[18px] text-[15px] font-medium text-text hover:border-accent ${FOCUS_RING}`}
          >
            {t('collection.importLink')}
          </Link>
        </div>
      </div>
    </section>
  );
}
