'use client';

import Link from 'next/link';
import { getCoinName, type GapSlot } from '@coin-collector/shared';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { formatCollectorNotation } from '@/lib/album-layout';
import type { CoinCardStatus } from '@/components/ui/coin-card';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import { StatusToggle } from '@/components/ui/status-toggle';
import { CoinRowMenu } from '@/components/sets/coin-row-menu';

export interface SetCoinListProps {
  slots: GapSlot[];
  visitor: boolean;
  statusFor: (coinId: string) => CoinCardStatus;
  /** The pill and its Retry. */
  onToggle: (slot: GapSlot) => void;
  otherSets: Array<{ id: string; name: string }>;
  onRemove: (slot: GapSlot) => void;
  onAddToSet: (slot: GapSlot, setId: string) => void;
}

// Coin disc · name block · year · status · ⋯. Under 900px the year column goes away.
const ROW_GRID =
  'grid grid-cols-[40px_minmax(0,1fr)_112px_150px_44px] items-center gap-x-4 px-4 max-[899px]:grid-cols-[40px_minmax(0,1fr)_auto_44px] max-[899px]:gap-x-3 max-[899px]:px-3';

/** The list table for one year group. Visitors get no toggle or menu (their cells stay empty). */
export function SetCoinList({ slots, visitor, statusFor, onToggle, otherSets, onRemove, onAddToSet }: SetCoinListProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="set-coin-list"
      className="overflow-visible rounded-[var(--radius-lg)] border border-neutral-300 bg-white"
    >
      <div
        data-testid="set-coin-list-head"
        aria-hidden="true"
        className={`${ROW_GRID} min-h-10 border-b border-neutral-300 bg-neutral-100 text-xs font-medium text-neutral-700 rounded-t-[var(--radius-lg)] max-[899px]:hidden`}
      >
        <span />
        <span>{t('setPage.listHeadCoin')}</span>
        <span>{t('setPage.listHeadYear')}</span>
        <span>{t('setPage.listHeadStatus')}</span>
        <span />
      </div>
      <ul>
        {slots.map((slot) => {
          const status: CoinCardStatus = visitor ? 'idle' : statusFor(slot.coin.id);
          const failed = status === 'failed';
          const name = getCoinName(slot.coin);

          return (
            <li
              key={slot.id}
              data-testid="set-coin-row"
              data-coin-id={slot.coin.id}
              data-status={status}
              className={`${ROW_GRID} group relative min-h-[60px] border-b border-neutral-200 py-2 last:border-b-0 hover:bg-neutral-100 ${failed ? 'bg-danger-bg' : ''}`.trimEnd()}
            >
              <PlaceholderCoin
                size={40}
                denomination={slot.coin.denomination}
                material={slot.coin.material}
                imageUrl={slot.coin.imageUrl}
                missing={!visitor && !slot.owned}
              />
              <div className="flex min-w-0 flex-col gap-px">
                {name.eyebrow !== '' && (
                  <span data-testid="set-coin-row-eyebrow" className="truncate text-[11px] font-medium text-neutral-700">
                    {name.eyebrow}
                  </span>
                )}
                <Link
                  data-testid="set-coin-row-link"
                  href={`/catalog/${slot.coin.id}`}
                  className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent-700 group-hover:underline"
                >
                  <span
                    data-testid="set-coin-row-title"
                    className="text-[15px] font-semibold leading-[1.3] text-text [overflow-wrap:anywhere]"
                  >
                    {name.title}
                  </span>
                </Link>
                <span
                  data-testid="set-coin-row-subtitle"
                  className={`text-xs ${failed ? 'font-medium text-danger' : 'text-neutral-700'}`}
                >
                  {failed ? t('setPage.rowFailed') : name.subtitle}
                </span>
              </div>
              <span
                data-testid="set-coin-row-year"
                className="font-mono text-sm tabular-nums text-neutral-800 max-[899px]:hidden"
              >
                {formatCollectorNotation(slot.coin)}
              </span>
              <div className="relative z-[3] flex items-center">
                {!visitor && (
                  <StatusToggle
                    variant="pill"
                    owned={slot.owned}
                    coinTitle={name.title}
                    state={status}
                    onToggle={() => onToggle(slot)}
                    collapseLabelOnMobile
                  />
                )}
              </div>
              {/* No z-index here: the open menu must stack above the rows that follow it. */}
              <div className="flex items-center justify-end">
                {!visitor && (
                  <CoinRowMenu
                    coinId={slot.coin.id}
                    coinTitle={name.title}
                    otherSets={otherSets}
                    onRemove={() => onRemove(slot)}
                    onAddToSet={(setId) => onAddToSet(slot, setId)}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
