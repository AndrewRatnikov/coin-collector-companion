'use client';

import Link from 'next/link';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { SetsTabs } from '@/components/layout/sets-tabs';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

export default function CanonicalSetsPage() {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useCanonicalSets();

  return (
    <main
      data-testid="canonical-sets-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10"
    >
      <SetsTabs />

      <div className="flex flex-col gap-2 border-b border-[color:var(--color-divider)] pb-4">
        <h1 className="font-[family-name:var(--font-heading)] text-[32px] font-semibold text-[color:var(--color-text)]">
          {t('canonicalSets.title')}
        </h1>
      </div>

      {isLoading && (
        <div data-testid="canonical-sets-loading">
          <ListSkeleton />
        </div>
      )}

      {isError && (
        <p data-testid="canonical-sets-error" className="text-sm text-[color:var(--color-accent-800)]">
          {t('canonicalSets.errorLoading')}
        </p>
      )}

      {data &&
        (data.length === 0 ? (
          <p data-testid="canonical-sets-empty" className="text-sm text-[color:var(--color-neutral-600)]">
            {t('canonicalSets.emptyMessage')}
          </p>
        ) : (
          <ul data-testid="canonical-sets-list" className="flex flex-col">
            {data.map((set) => (
              <li
                key={set.id}
                data-testid="canonical-set-item"
                className="border-b border-[color:var(--color-divider)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)]"
              >
                <Link
                  href={`/sets/canonical/${set.id}`}
                  className="flex items-center justify-between gap-6 py-5 text-[color:var(--color-text)]"
                >
                  <span className="flex flex-col gap-1">
                    <span className="font-[family-name:var(--font-heading)] text-[21px] font-semibold">
                      {resolveLocalizedText(set.name, locale)}
                    </span>
                    {set.description && (
                      <span className="text-sm text-[color:var(--color-neutral-600)]">
                        {resolveLocalizedText(set.description, locale)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
