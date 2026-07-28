'use client';

import Link from 'next/link';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSets } from '@/lib/hooks/use-public-sets';
import { useTranslation } from '@/lib/i18n/i18n-context';

const ROW_CLASSES =
  'flex items-baseline justify-between gap-6 border-b border-[color:var(--color-divider)] py-5 text-[color:var(--color-text)] transition-colors hover:text-[color:var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)]';

export default function Home() {
  const { t } = useTranslation();

  const catalog = useCatalog({ page: 1, limit: 1 });
  const canonicalSets = useCanonicalSets();
  const publicSets = usePublicSets({ page: 1, limit: 1 });

  const catalogTotal = !catalog.isLoading && catalog.data ? catalog.data.total : null;
  const canonicalTotal = !canonicalSets.isLoading && canonicalSets.data ? canonicalSets.data.length : null;
  const publicTotal = !publicSets.isLoading && publicSets.data ? publicSets.data.total : null;

  return (
    <main
      data-testid="home-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-8 px-[clamp(20px,5vw,48px)] py-16"
    >
      <div className="flex flex-col gap-5">
        <p
          data-testid="home-eyebrow"
          className="text-[11px] font-medium uppercase tracking-[.16em] text-[color:var(--color-neutral-600)]"
        >
          {t('home.eyebrow')}
        </p>
        <h1
          data-testid="home-headline"
          className="max-w-[18ch] font-[family-name:var(--font-heading)] text-[clamp(40px,6vw,68px)] font-normal leading-[1.05] text-[color:var(--color-text)]"
        >
          {t('home.headline')}
        </h1>
        <p className="max-w-[60ch] text-[15px] leading-relaxed text-[color:var(--color-neutral-700)]">
          {t('home.paragraph')}
        </p>
      </div>

      <nav className="flex flex-col border-t border-[color:var(--color-divider)]">
        <Link href="/catalog" data-testid="home-catalog-link" className={ROW_CLASSES}>
          <span className="text-[17px]">{t('home.browseCatalogue')}</span>
          {catalogTotal !== null && (
            <span className="font-mono text-sm tabular-nums text-[color:var(--color-neutral-600)]">
              {catalogTotal} {t('home.coinsUnit')}
            </span>
          )}
        </Link>
        <Link href="/sets/canonical" data-testid="home-canonical-link" className={ROW_CLASSES}>
          <span className="text-[17px]">{t('home.browseCanonical')}</span>
          {canonicalTotal !== null && (
            <span className="font-mono text-sm tabular-nums text-[color:var(--color-neutral-600)]">
              {canonicalTotal} {t('home.setsUnit')}
            </span>
          )}
        </Link>
        <Link href="/sets/public" data-testid="home-public-link" className={ROW_CLASSES}>
          <span className="text-[17px]">{t('home.browsePublic')}</span>
          {publicTotal !== null && (
            <span className="font-mono text-sm tabular-nums text-[color:var(--color-neutral-600)]">
              {publicTotal} {t('home.setsUnit')}
            </span>
          )}
        </Link>
      </nav>
    </main>
  );
}
