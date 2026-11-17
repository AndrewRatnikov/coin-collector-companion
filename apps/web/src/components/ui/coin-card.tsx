'use client';

import Link from 'next/link';
import { getCoinName, type CatalogCoin, type CoinGrade } from '@coin-collector/shared';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { Badge } from '@/components/ui/badge';
import { GradeChip } from '@/components/ui/grade-chip';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import { StatusToggle, TickIcon, useDelayedPending } from '@/components/ui/status-toggle';
import { UpgradeBadge } from '@/components/ui/upgrade-badge';

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
  /** Passed to the card's StatusToggle as ariaLabel. */
  toggleLabel?: string;
  /** coin-card-status text when not owned (idle). Default t('ui.coin.statusMissing'). */
  missingStatusLabel?: string;
  /** The owner's grade; a chip shows after the status text when owned and graded. Default null. */
  grade?: CoinGrade | null;
  /** API's needsUpgrade for this slot; shows the Upgrade state when owned and not a visitor. Default false. */
  needsUpgrade?: boolean;
  /** 'compact' is the small demo card: no eyebrow or subtitle, no lift, small key-date badge in the body. */
  density?: CoinCardDensity;
  /** Replaces getCoinName(coin).title in coin-card-title (e.g. collector notation "1909-S VDB"). */
  titleOverride?: string;
  /** coin-card-status text when owned (idle). Default t('ui.coin.statusOwned'). */
  ownedStatusLabel?: string;
  /** false: the title is plain text, with no link to the coin page. Default true. */
  linkToCoin?: boolean;
  /** true: an aria-hidden check disc replaces the StatusToggle, so the card has no control. Default false. */
  readOnly?: boolean;
}

export type CoinCardDensity = 'default' | 'compact';

function noop() {}

/** The non-interactive check disc of a read-only card: solid tick when owned, dashed when missing. */
function ReadOnlyCheck({ owned, compact }: { owned: boolean; compact: boolean }) {
  const face = owned
    ? 'bg-accent border-2 border-white text-white shadow-sm'
    : 'bg-white/90 border-[1.5px] border-dashed border-neutral-500 text-neutral-500';
  return (
    <span
      data-testid="coin-card-check"
      aria-hidden="true"
      className={`absolute right-1 top-1 z-[3] inline-flex items-center justify-center ${compact ? 'size-9' : 'size-11'}`}
    >
      <span className={`flex items-center justify-center rounded-full ${compact ? 'size-6' : 'size-8'} ${face}`}>
        <TickIcon className={compact ? 'size-3' : 'size-4'} />
      </span>
    </span>
  );
}

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
  toggleLabel,
  missingStatusLabel,
  grade = null,
  needsUpgrade = false,
  density = 'default',
  titleOverride,
  ownedStatusLabel,
  linkToCoin = true,
  readOnly = false,
}: CoinCardProps) {
  const { t } = useTranslation();
  const name = getCoinName(coin);
  const titleText = titleOverride ?? name.title;
  const compact = density === 'compact';
  const showSaving = useDelayedPending(status === 'pending');

  const ownedLook = owned && !visitor;
  const failed = status === 'failed';
  const upgrade = needsUpgrade && owned && !visitor;
  const dataState = visitor ? 'visitor' : owned ? 'owned' : 'missing';

  const rootClasses = [
    'group relative flex flex-col rounded-lg border overflow-hidden',
    'motion-safe:transition motion-safe:duration-150',
    compact ? '' : 'motion-safe:hover:-translate-y-0.5 motion-safe:focus-within:-translate-y-0.5',
    'hover:shadow-md focus-within:shadow-md hover:border-accent focus-within:border-accent',
    ownedLook ? 'bg-accent-100 shadow-sm' : 'bg-neutral-100',
    failed
      ? 'border-danger'
      : upgrade
        ? 'border-dashed border-accent-700'
        : ownedLook
          ? 'border-accent-400'
          : 'border-neutral-300',
    selected ? 'outline-3 outline-accent-700 -outline-offset-2' : '',
  ]
    .filter((part) => part !== '')
    .join(' ');

  const title = (
    <span
      data-testid="coin-card-title"
      className={
        compact
          ? 'font-mono text-[13px] font-medium leading-[1.3] text-text'
          : 'text-[15px] font-semibold leading-[1.3] text-text group-hover:text-accent-700'
      }
    >
      {titleText}
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
    } else if (owned && upgrade) {
      statusLine = (
        <span data-testid="coin-card-status" className="flex items-center">
          <UpgradeBadge testId="coin-card-upgrade" />
        </span>
      );
    } else if (owned) {
      statusLine = (
        <span data-testid="coin-card-status" className="font-medium text-accent-700">
          {ownedStatusLabel ?? t('ui.coin.statusOwned')}
        </span>
      );
    } else {
      statusLine = (
        <span data-testid="coin-card-status" className="text-neutral-700">
          {missingStatusLabel ?? t('ui.coin.statusMissing')}
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
      data-upgrade={upgrade ? 'true' : 'false'}
      data-density={density}
      className={rootClasses}
    >
      <div
        data-testid="coin-card-well"
        className={`@container relative aspect-[4/3] flex items-center justify-center ${ownedLook ? 'bg-accent-200' : 'bg-neutral-200'}`}
      >
        {coin.isKeyDate && !compact && (
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
          className={compact ? 'size-[52cqw]! text-[52cqw]!' : ''}
        />
      </div>

      <div className={`flex min-w-0 flex-col gap-px ${compact ? 'px-2 pt-[7px] pb-2' : 'px-3 pt-2.5 pb-3'}`}>
        {name.eyebrow !== '' && !hideEyebrow && !compact && (
          <span data-testid="coin-card-eyebrow" className="truncate text-[11px] font-medium text-neutral-700">
            {name.eyebrow}
          </span>
        )}
        {selectMode || !linkToCoin ? (
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
        {!compact && (
          <span data-testid="coin-card-subtitle" className="text-xs text-neutral-700">
            {name.subtitle}
          </span>
        )}

        {statusLine && (
          <div
            className={`mt-1.5 flex min-h-5 items-center justify-between gap-1.5 ${compact ? 'text-[11px]' : 'text-xs'}`}
          >
            {owned && !visitor && grade !== null ? (
              <span className="flex min-w-0 items-center gap-1.5">
                {statusLine}
                <GradeChip grade={grade} testId="coin-card-grade" className="relative z-[3]" />
              </span>
            ) : (
              statusLine
            )}
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
        {compact && coin.isKeyDate && (
          <span className="mt-1 flex">
            <Badge variant="key-date" size="small" />
          </span>
        )}
      </div>

      {!visitor && !selectMode && readOnly && <ReadOnlyCheck owned={owned} compact={compact} />}

      {!visitor && !selectMode && !readOnly && (
        <StatusToggle
          variant="check"
          owned={owned}
          coinTitle={titleText}
          state={status}
          onToggle={onToggle}
          ariaLabel={toggleLabel}
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
