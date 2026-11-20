'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import type { WantCoin } from '@coin-collector/shared';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';
import { wantCoinLabel } from '@/lib/missing-list';

export interface WantListSetsDisclosureProps {
  /** Missing entries or upgrade entries, rendered in the given order. */
  entries: WantCoin[];
  /** Rendered as data-section. */
  section: 'missing' | 'upgrade';
}

/**
 * The closed "Which sets?" list under a want-list section: each coin with links to the sets
 * that want it. Hidden in print.
 */
export function WantListSetsDisclosure({ entries, section }: WantListSetsDisclosureProps) {
  const { t, locale } = useTranslation();

  return (
    <details data-testid="want-list-sets" data-section={section} className="text-[13px] text-neutral-800 print:hidden">
      <summary
        data-testid="want-list-sets-summary"
        className="w-fit cursor-pointer text-neutral-700 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
      >
        {t('wantList.whichSets')}
      </summary>
      <ul className="mt-2 flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.coin.id} data-testid="want-list-sets-item" data-coin-id={entry.coin.id}>
            <span data-testid="want-list-sets-coin" className="font-mono">
              {wantCoinLabel(entry.coin)}
            </span>
            {': '}
            {entry.sets.map((set, index) => (
              <Fragment key={set.id}>
                {index > 0 && ', '}
                <Link
                  href={`/sets/${set.id}`}
                  data-testid="want-list-sets-link"
                  className="text-accent-700 underline-offset-2 hover:underline"
                >
                  {resolveLocalizedText(set.name, locale)}
                </Link>
              </Fragment>
            ))}
          </li>
        ))}
      </ul>
    </details>
  );
}
