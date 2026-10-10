'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { GapSlot } from '@coin-collector/shared';
import {
  buildAlbumLayout,
  formatAlbumCardLabel,
  formatAlbumCheckLabel,
  formatAlbumPageHeading,
  formatOwnedOfTotal,
  getAlbumCardText,
  getDenominationNumeral,
  getSharedEyebrow,
  hasBlankCells,
  isNoMintMarkPage,
  type AlbumSlotLabelWords,
} from '@/lib/album-layout';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SetAlbumProps {
  slots: GapSlot[];
  isOwner: boolean;
  gapOnly: boolean;
  onToggle: (coinId: string, currentlyOwned: boolean) => void;
  pendingCoinId?: string | null;
  // Coins whose ownership request is in flight; their check buttons are disabled and aria-busy.
  pendingCoinIds?: ReadonlySet<string>;
  toggleFailed?: boolean;
}

const STICKY_YEAR_CLASSNAME =
  'sticky left-0 z-20 bg-bg border-r border-divider px-2 py-1 text-left text-sm font-semibold';

const BLANK_CELL_CLASSNAME =
  'min-w-12 border border-transparent bg-[repeating-linear-gradient(45deg,var(--color-neutral-200)_0_4px,transparent_4px_8px)] px-1 py-1';

const HEADING_FONT_CLASSNAME = 'font-[family-name:var(--font-heading)]';

const CIRCLE_BASE_CLASSNAME = 'relative inline-flex shrink-0 items-center justify-center rounded-full';
const CIRCLE_OWNED_CLASSNAME = 'border border-solid border-accent bg-accent text-white';
const CIRCLE_MISSING_CLASSNAME = 'border-2 border-dashed border-neutral-500 bg-transparent text-neutral-600';
const CIRCLE_IMAGE_OWNED_CLASSNAME = 'border-2 border-solid border-accent bg-surface';
const CIRCLE_IMAGE_MISSING_CLASSNAME = 'border-2 border-dashed border-neutral-500 bg-surface opacity-70';

const OWNED_MARK_CLASSNAME =
  'absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-bg bg-accent text-[0.625rem] leading-none text-white';

const KEY_DATE_BADGE_CLASSNAME =
  'inline-flex w-fit items-center rounded-full bg-accent-100 px-1.5 text-xs text-accent-800';

const CARD_LINK_CLASSNAME = [
  'font-semibold text-sm leading-snug text-inherit hover:underline',
  "after:absolute after:inset-0 after:rounded-[var(--radius-lg)] after:content-['']",
  'focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2',
  'focus-visible:after:outline-[var(--color-accent-700)]',
].join(' ');

const CHECK_BASE_CLASSNAME = [
  'absolute right-1 top-1 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm',
  'hover:bg-accent-100 hover:border-accent',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-700)]',
  'disabled:cursor-progress',
].join(' ');
const CHECK_PRESSED_CLASSNAME = 'border-accent bg-accent text-white hover:text-accent-800';
const CHECK_UNPRESSED_CLASSNAME = 'border-neutral-500 bg-bg text-neutral-400 hover:text-accent-800';

function CoinCircle({
  denomination,
  imageUrl,
  owned,
  sizeClassName,
}: {
  denomination: string;
  imageUrl: string | null;
  owned: boolean;
  sizeClassName: string;
}) {
  const stateClassName = imageUrl
    ? owned
      ? CIRCLE_IMAGE_OWNED_CLASSNAME
      : CIRCLE_IMAGE_MISSING_CLASSNAME
    : owned
      ? CIRCLE_OWNED_CLASSNAME
      : CIRCLE_MISSING_CLASSNAME;
  return (
    <span
      data-testid="set-album-card-circle"
      aria-hidden="true"
      className={`${CIRCLE_BASE_CLASSNAME} ${sizeClassName} ${stateClassName}`}
    >
      {imageUrl ? (
        <img
          data-testid="set-album-card-image"
          src={imageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span data-testid="set-album-card-numeral" className={`${HEADING_FONT_CLASSNAME} text-base font-semibold`}>
          {getDenominationNumeral(denomination)}
        </span>
      )}
      {owned && (
        <span data-testid="set-album-card-owned-mark" className={OWNED_MARK_CLASSNAME}>
          ✓
        </span>
      )}
    </span>
  );
}

function AlbumCard({
  slot,
  isOwner,
  gapOnly,
  onToggle,
  pending,
  words,
  hoistedEyebrow,
  keyDateBadge,
  markOwned,
  markMissing,
}: {
  slot: GapSlot;
  isOwner: boolean;
  gapOnly: boolean;
  onToggle: (coinId: string, currentlyOwned: boolean) => void;
  pending: boolean;
  words: AlbumSlotLabelWords;
  hoistedEyebrow: boolean;
  keyDateBadge: string;
  markOwned: string;
  markMissing: string;
}) {
  const { coin, owned } = slot;
  const text = getAlbumCardText(coin);
  const muted = gapOnly && owned;
  const className = [
    'relative flex gap-3 rounded-[var(--radius-lg)] border border-divider bg-surface p-2',
    'transition-shadow hover:border-accent hover:shadow-md',
    muted ? 'opacity-40' : '',
    isOwner ? 'pr-11' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      data-testid="set-album-card"
      data-coin-id={coin.id}
      data-owned={owned ? 'true' : 'false'}
      data-key-date={coin.isKeyDate ? 'true' : 'false'}
      data-muted={muted ? 'true' : 'false'}
      className={className}
    >
      <CoinCircle denomination={coin.denomination} imageUrl={coin.imageUrl} owned={owned} sizeClassName="h-10 w-10" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 break-words">
        {text.eyebrow && !hoistedEyebrow && (
          <p data-testid="set-album-card-eyebrow" className="text-xs text-neutral-600">
            {text.eyebrow}
          </p>
        )}
        <Link
          data-testid="set-album-card-link"
          href={`/catalog/${coin.id}`}
          aria-label={formatAlbumCardLabel(slot, words)}
          className={CARD_LINK_CLASSNAME}
        >
          <span data-testid="set-album-card-title">{text.title}</span>
        </Link>
        <p data-testid="set-album-card-secondary" className="text-xs text-neutral-700">
          {text.secondary}
        </p>
        {coin.isKeyDate && (
          <span data-testid="set-album-card-key-date" className={KEY_DATE_BADGE_CLASSNAME}>
            {keyDateBadge}
          </span>
        )}
      </div>
      {isOwner && (
        <button
          type="button"
          data-testid="set-album-card-check"
          data-coin-id={coin.id}
          aria-pressed={owned}
          aria-label={formatAlbumCheckLabel(owned ? markMissing : markOwned, coin)}
          aria-busy={pending ? true : undefined}
          disabled={pending}
          onClick={() => onToggle(coin.id, owned)}
          className={`${CHECK_BASE_CLASSNAME} ${owned ? CHECK_PRESSED_CLASSNAME : CHECK_UNPRESSED_CLASSNAME}`}
        >
          <span aria-hidden="true">✓</span>
        </button>
      )}
    </li>
  );
}

export function SetAlbum({
  slots,
  isOwner,
  gapOnly,
  onToggle,
  pendingCoinId,
  pendingCoinIds,
  toggleFailed,
}: SetAlbumProps) {
  const { t } = useTranslation();
  const pages = useMemo(() => buildAlbumLayout(slots), [slots]);

  if (slots.length === 0) {
    return (
      <div data-testid="set-album" className="flex flex-col gap-6">
        <p data-testid="set-album-empty" className="text-sm text-neutral-600">
          {t('setAlbum.empty')}
          {isOwner && (
            <>
              {' '}
              <span data-testid="set-album-empty-owner-hint">{t('setAlbum.emptyOwnerHint')}</span>
            </>
          )}
        </p>
      </div>
    );
  }

  const words: AlbumSlotLabelWords = {
    owned: t('common.owned'),
    missing: t('common.missing'),
    keyDate: t('setAlbum.keyDate'),
  };
  const keyDateBadge = t('setAlbum.keyDateBadge');
  const markOwned = t('setAlbum.markOwned');
  const markMissing = t('setAlbum.markMissing');
  const noMintMark = t('setAlbum.noMintMark');
  const showBlankLegend = pages.some(hasBlankCells);

  const isPending = (coinId: string) => pendingCoinId === coinId || Boolean(pendingCoinIds?.has(coinId));

  const renderCards = (cardSlots: GapSlot[], hoistedEyebrow: boolean) =>
    cardSlots.map((slot) => (
      <AlbumCard
        key={slot.id}
        slot={slot}
        isOwner={isOwner}
        gapOnly={gapOnly}
        onToggle={onToggle}
        pending={isPending(slot.coin.id)}
        words={words}
        hoistedEyebrow={hoistedEyebrow}
        keyDateBadge={keyDateBadge}
        markOwned={markOwned}
        markMissing={markMissing}
      />
    ));

  return (
    <div data-testid="set-album" className="flex min-w-0 flex-col gap-6">
      {toggleFailed && (
        <p data-testid="set-album-toggle-error" role="alert" className="text-sm text-red-600">
          {t('setAlbum.toggleError')}
        </p>
      )}
      <ul
        data-testid="set-album-legend"
        aria-label={t('setAlbum.legendLabel')}
        className="flex flex-wrap items-center gap-4 text-sm text-neutral-700"
      >
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`${CIRCLE_BASE_CLASSNAME} h-5 w-5 text-xs ${CIRCLE_OWNED_CLASSNAME}`}
          >
            ✓
          </span>
          {t('setAlbum.legendOwned')}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`${CIRCLE_BASE_CLASSNAME} h-5 w-5 ${CIRCLE_MISSING_CLASSNAME}`} />
          {t('setAlbum.legendMissing')}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={KEY_DATE_BADGE_CLASSNAME}>
            ★
          </span>
          {t('setAlbum.legendKeyDate')}
        </li>
        {showBlankLegend && (
          <li data-testid="set-album-legend-blank" className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`inline-block h-5 w-5 ${BLANK_CELL_CLASSNAME}`} />
            {t('setAlbum.legendBlank')}
          </li>
        )}
      </ul>

      {pages.map((page, pageIndex) => {
        const headingId = `set-album-page-heading-${pageIndex}`;
        const sharedEyebrow = getSharedEyebrow(page);
        const hoisted = sharedEyebrow !== '';
        return (
          <section
            key={page.key}
            data-testid="set-album-page"
            aria-labelledby={headingId}
            className="flex min-w-0 flex-col gap-2"
          >
            <h2
              data-testid="set-album-page-heading"
              id={headingId}
              className={`${HEADING_FONT_CLASSNAME} text-xl font-semibold break-words`}
            >
              {formatAlbumPageHeading(page)}
            </h2>
            {hoisted && (
              <p data-testid="set-album-page-eyebrow" className="text-sm text-neutral-700 break-words">
                {sharedEyebrow}
              </p>
            )}
            <p data-testid="set-album-page-count" className="text-sm text-neutral-600">
              {formatOwnedOfTotal(t('setAlbum.ownedOfTotal'), page.ownedCount, page.totalCount)}
            </p>
            {isNoMintMarkPage(page) ? (
              <div className="flex min-w-0 flex-col gap-4">
                {page.rows.map((row) => (
                  <div
                    key={row.year}
                    data-testid="set-album-year-group"
                    data-year={row.year}
                    className="flex min-w-0 flex-col gap-2"
                  >
                    <h3
                      data-testid="set-album-year-label"
                      className={`${HEADING_FONT_CLASSNAME} border-b border-divider pb-1 text-base font-semibold`}
                    >
                      {row.year}
                    </h3>
                    <ul
                      data-testid="set-album-year-grid"
                      className="grid list-none grid-cols-[repeat(auto-fill,minmax(min(170px,100%),1fr))] gap-2 p-0"
                    >
                      {renderCards(
                        row.cells.flatMap((cell) => cell.slots),
                        hoisted,
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div data-testid="set-album-scroll" className="w-full max-w-full overflow-x-auto">
                <table data-testid="set-album-table" className="border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th scope="col" className={STICKY_YEAR_CLASSNAME}>
                        {t('setAlbum.yearHeader')}
                      </th>
                      {page.columns.map((column) => (
                        <th
                          key={column.mintMark}
                          scope="col"
                          data-testid="set-album-col-header"
                          data-mint-mark={column.mintMark}
                          className="border-b border-divider px-2 py-1 text-center text-sm font-semibold"
                        >
                          {column.mintMark === '' ? noMintMark : column.mintMark}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {page.rows.map((row) => (
                      <tr key={row.year} data-testid="set-album-row" data-year={row.year}>
                        <th scope="row" data-testid="set-album-year-header" className={STICKY_YEAR_CLASSNAME}>
                          {row.year}
                        </th>
                        {row.cells.map((cell) =>
                          cell.slots.length === 0 ? (
                            <td
                              key={cell.mintMark}
                              data-testid="set-album-blank-cell"
                              data-year={cell.year}
                              data-mint-mark={cell.mintMark}
                              className={BLANK_CELL_CLASSNAME}
                            >
                              <span className="sr-only">{t('setAlbum.blankCell')}</span>
                            </td>
                          ) : (
                            <td
                              key={cell.mintMark}
                              data-testid="set-album-cell"
                              data-year={cell.year}
                              data-mint-mark={cell.mintMark}
                              className="min-w-[10rem] border-b border-divider px-1 py-1 align-top"
                            >
                              <ul className="flex list-none flex-col gap-1 p-0">
                                {renderCards(cell.slots, hoisted)}
                              </ul>
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" className={STICKY_YEAR_CLASSNAME}>
                        {t('setAlbum.columnTotals')}
                      </th>
                      {page.columns.map((column) => (
                        <td
                          key={column.mintMark}
                          data-testid="set-album-col-footer"
                          data-mint-mark={column.mintMark}
                          className="px-2 py-1 text-center text-xs text-neutral-600"
                        >
                          {`${column.ownedCount}/${column.totalCount}`}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
