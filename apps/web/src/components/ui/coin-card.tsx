'use client';

import Link from 'next/link';
import { getCoinName, type CatalogCoin } from '@coin-collector/shared';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { Badge } from '@/components/ui/badge';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import { StatusToggle, useDelayedPending } from '@/components/ui/status-toggle';

export type CoinCardStatus = 'idle' | 'pending' | 'failed';

export interface CoinCardProps {
  coin: CatalogCoin;
  owned: boolean;
  status?: CoinCardStatus;
  visitor?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  onSelect?: () => void;
  hideEyebrow?: boolean;
}

function noop() {}

/**
 * One coin in a grid: the coin well, the getCoinName block as a stretched link to the coin page,
 * the owner's status line and the round check. Visitors see no status or check; select mode
 * swaps the link and check for a full-card select button. Callers wrap it in an <li>.
 */
export function CoinCard({
  coin,
  owned,
  status = 'idle',
  visitor = false,
  selectMode = false,
  selected = false,
  onToggle = noop,
  onSelect = noop,
  hideEyebrow = false,
}: CoinCardProps) {
  const { t } = useTranslation();
  const name = getCoinName(coin);
  const showSaving = useDelayedPending(status === 'pending');

  const ownedLook = owned && !visitor;
  const failed = status === 'failed';
  const dataState = visitor ? 'visitor' : owned ? 'owned' : 'missing';

  const rootClasses = [
    'group relative flex flex-col rounded-lg border overflow-hidden',
    'motion-safe:transition motion-safe:duration-150',
    'motion-safe:hover:-translate-y-0.5 motion-safe:focus-within:-translate-y-0.5',
    'hover:shadow-md focus-within:shadow-md hover:border-accent focus-within:border-accent',
    ownedLook ? 'bg-accent-100 shadow-sm' : 'bg-neutral-100',
    failed ? 'border-danger' : ownedLook ? 'border-accent-400' : 'border-neutral-300',
    selected ? 'outline-3 outline-accent-700 -outline-offset-2' : '',
  ]
    .filter((part) => part !== '')
    .join(' ');

  const title = (
    <span
      data-testid="coin-card-title"
      className="text-[15px] font-semibold leading-[1.3] text-text group-hover:text-accent-700"
    >
      {name.title}
    </span>
  );

  let statusLine = null;
  if (!visitor) {
    if (status === 'pending' && showSaving) {
      statusLine = (
        <span data-testid="coin-card-status" className="italic text-neutral-700">
          {t('ui.coin.statusPending')}
        </span>
      );
    } else if (failed) {
      statusLine = (
        <span data-testid="coin-card-status" role="alert" className="font-medium text-danger">
          {t('ui.coin.statusFailed')}
        </span>
      );
    } else if (owned) {
      statusLine = (
        <span data-testid="coin-card-status" className="font-medium text-accent-700">
          {t('ui.coin.statusOwned')}
        </span>
      );
    } else {
      statusLine = (
        <span data-testid="coin-card-status" className="text-neutral-700">
          {t('ui.coin.statusMissing')}
        </span>
      );
    }
  }

  return (
    <div
      data-testid="coin-card"
      data-coin-id={coin.id}
      data-state={dataState}
      data-status={status}
      data-selected={selected ? 'true' : 'false'}
      data-key-date={coin.isKeyDate ? 'true' : 'false'}
      className={rootClasses}
    >
      <div
        data-testid="coin-card-well"
        className={`@container relative aspect-[4/3] flex items-center justify-center ${ownedLook ? 'bg-accent-200' : 'bg-neutral-200'}`}
      >
        {coin.isKeyDate && (
          <span className="absolute left-2 top-2.5">
            <Badge variant="key-date" />
          </span>
        )}
        <PlaceholderCoin
          size="fluid"
          denomination={coin.denomination}
          material={coin.material}
          imageUrl={coin.imageUrl}
          missing={!owned && !visitor}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-px px-3 pt-2.5 pb-3">
        {name.eyebrow !== '' && !hideEyebrow && (
          <span data-testid="coin-card-eyebrow" className="truncate text-[11px] font-medium text-neutral-700">
            {name.eyebrow}
          </span>
        )}
        {selectMode ? (
          title
        ) : (
          <Link
            data-testid="coin-card-link"
            href={`/catalog/${coin.id}`}
            className="after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent-700 group-hover:underline"
          >
            {title}
          </Link>
        )}
        <span data-testid="coin-card-subtitle" className="text-xs text-neutral-700">
          {name.subtitle}
        </span>

        {statusLine && (
          <div className="mt-1.5 flex min-h-5 items-center justify-between gap-1.5 text-xs">
            {statusLine}
            {failed && (
              <button
                type="button"
                data-testid="coin-card-retry"
                onClick={onToggle}
                className="relative z-[3] cursor-pointer rounded-[var(--radius-md)] px-1.5 font-semibold text-danger underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
              >
                {t('ui.coin.retry')}
              </button>
            )}
          </div>
        )}
      </div>

      {!visitor && !selectMode && (
        <StatusToggle
          variant="check"
          owned={owned}
          coinTitle={name.title}
          state={status}
          onToggle={onToggle}
          className="absolute right-1 top-1 z-[3]"
        />
      )}

      {selectMode && (
        <button
          type="button"
          data-testid="coin-card-select"
          aria-pressed={selected}
          aria-label={t('ui.coin.select').split('{coin}').join(name.title)}
          onClick={onSelect}
          className="absolute inset-0 z-[4] cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-700"
        />
      )}
    </div>
  );
}
