'use client';

import { useId } from 'react';
import Link from 'next/link';
import { getCoinName, type OwnershipItem } from '@coin-collector/shared';
import { CoinCard, type CoinCardStatus } from '@/components/ui/coin-card';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import { StatusToggle } from '@/components/ui/status-toggle';
import type { CollectionLayout, CollectionSubgroup } from '@/lib/collection-view';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface CollectionSubgroupSectionProps {
  subgroup: CollectionSubgroup;
  open: boolean;
  onToggleOpen: () => void;
  layout: CollectionLayout;
  isOwned: (coinId: string) => boolean;
  statusFor: (coinId: string) => CoinCardStatus;
  labelsFor: (item: OwnershipItem) => { toggle: string };
  onToggleOwned: (item: OwnershipItem) => void;
}

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

// Coin disc · name block · status pill. Under 900px the pill column shrinks to fit.
const ROW_GRID =
  'grid grid-cols-[40px_minmax(0,1fr)_150px] items-center gap-x-4 px-4 max-[899px]:grid-cols-[40px_minmax(0,1fr)_auto] max-[899px]:gap-x-3 max-[899px]:px-3';

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`flex-none motion-safe:transition ${open ? 'rotate-90' : ''}`.trimEnd()}
    >
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** One series or denomination inside a country: a disclosure header, then a Cards grid or a Rows list. */
export function CollectionSubgroupSection({
  subgroup,
  open,
  onToggleOpen,
  layout,
  isOwned,
  statusFor,
  labelsFor,
  onToggleOwned,
}: CollectionSubgroupSectionProps) {
  const { t } = useTranslation();
  const contentId = useId();
  const count = subgroup.items.length;
  const countText =
    count === 1 ? t('collection.coinCountOne') : t('collection.coinCount').split('{n}').join(String(count));

  return (
    <div data-testid="collection-subgroup" data-subgroup-key={subgroup.key} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="collection-subgroup-toggle"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggleOpen}
          className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] text-left text-text ${FOCUS_RING}`}
        >
          <ChevronIcon open={open} />
          <span
            data-testid="collection-subgroup-name"
            className="font-heading text-[22px] leading-[1.15] font-semibold lining-nums [overflow-wrap:anywhere]"
          >
            {subgroup.name}
          </span>
        </button>
        <span
          data-testid="collection-subgroup-count"
          className="flex-none font-mono text-[13px] text-neutral-700 lining-nums tabular-nums"
        >
          {countText}
        </span>
        <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-neutral-300" />
      </div>

      {open && (
        <div id={contentId}>
          {layout === 'cards' ? (
            <ul
              data-testid="collection-subgroup-cards"
              className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(172px,100%),1fr))] gap-3.5 p-0 max-[899px]:grid-cols-2 max-[899px]:gap-2.5"
            >
              {subgroup.items.map((item) => (
                <li key={item.coinId} className="min-w-0">
                  <CoinCard
                    coin={item.coin}
                    owned={isOwned(item.coinId)}
                    status={statusFor(item.coinId)}
                    onToggle={() => onToggleOwned(item)}
                    toggleLabel={labelsFor(item).toggle}
                    missingStatusLabel={t('collection.statusRemoved')}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul
              data-testid="collection-subgroup-rows"
              className="m-0 list-none overflow-visible rounded-[var(--radius-lg)] border border-neutral-300 bg-white p-0"
            >
              {subgroup.items.map((item) => {
                const owned = isOwned(item.coinId);
                const status = statusFor(item.coinId);
                const name = getCoinName(item.coin);
                return (
                  <li
                    key={item.coinId}
                    data-testid="collection-row"
                    data-coin-id={item.coinId}
                    data-state={owned ? 'owned' : 'removed'}
                    data-status={status}
                    className={`${ROW_GRID} group relative min-h-[60px] border-b border-neutral-200 py-2 last:border-b-0 hover:bg-neutral-100 ${status === 'failed' ? 'bg-danger-bg' : ''}`.trimEnd()}
                  >
                    <PlaceholderCoin
                      size={40}
                      denomination={item.coin.denomination}
                      material={item.coin.material}
                      imageUrl={item.coin.imageUrl}
                      missing={!owned}
                    />
                    <div className="flex min-w-0 flex-col gap-px">
                      {name.eyebrow !== '' && (
                        <span
                          data-testid="collection-row-eyebrow"
                          className="truncate text-[11px] font-medium text-neutral-700"
                        >
                          {name.eyebrow}
                        </span>
                      )}
                      <Link
                        data-testid="collection-row-link"
                        href={`/catalog/${item.coinId}`}
                        className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent-700 group-hover:underline"
                      >
                        <span
                          data-testid="collection-row-title"
                          className="text-[15px] font-semibold leading-[1.3] text-text [overflow-wrap:anywhere]"
                        >
                          {name.title}
                        </span>
                      </Link>
                      <span data-testid="collection-row-subtitle" className="text-xs text-neutral-700">
                        {name.subtitle}
                      </span>
                    </div>
                    <div className="relative z-[3] flex items-center">
                      <StatusToggle
                        variant="pill"
                        owned={owned}
                        coinTitle={name.title}
                        state={status}
                        onToggle={() => onToggleOwned(item)}
                        ariaLabel={labelsFor(item).toggle}
                        missingLabel={t('collection.statusRemoved')}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
