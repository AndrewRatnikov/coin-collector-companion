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
  type AlbumRow,
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

const KEY_DATE_BADGE_CLASSNAME =
  'inline-flex w-fit items-center rounded-full bg-accent-100 px-1.5 text-xs text-accent-800';
const KEY_DATE_PILL_CLASSNAME =
  'absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-accent-800 px-2 py-0.5 text-[11px] font-medium text-accent-100';

const CARD_BASE_CLASSNAME = [
  'group relative flex flex-col rounded-[var(--radius-lg)] border',
  'transition-[transform,box-shadow,border-color] duration-150',
  'hover:-translate-y-0.5 hover:border-accent hover:shadow-md',
].join(' ');
const CARD_OWNED_CLASSNAME = 'border-accent-400 bg-accent-100 shadow-sm';
const CARD_MISSING_CLASSNAME = 'border-neutral-300 bg-neutral-100';

// The well rounds its own top corners (no overflow-hidden on the card, which must never clip text).
const WELL_BASE_CLASSNAME =
  'relative flex aspect-[4/3] items-center justify-center rounded-t-[calc(var(--radius-lg)-1px)]';

const CARD_LINK_CLASSNAME = [
  'font-semibold text-[15px] leading-snug text-inherit',
  'group-hover:text-accent-700 group-hover:underline',
  "after:absolute after:inset-0 after:rounded-[var(--radius-lg)] after:content-['']",
  'focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2',
  'focus-visible:after:outline-[var(--color-accent-700)]',
].join(' ');

const CHECK_BASE_CLASSNAME = [
  'absolute right-1 top-1 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-700)]',
  'disabled:cursor-progress',
].join(' ');
const CHECK_FACE_BASE_CLASSNAME = 'inline-flex h-8 w-8 items-center justify-center rounded-full';
const CHECK_PRESSED_CLASSNAME = 'text-white hover:text-accent-100';
const CHECK_UNPRESSED_CLASSNAME = 'text-neutral-500 hover:text-accent-800';
const CHECK_FACE_PRESSED_CLASSNAME = 'border-2 border-solid border-white bg-accent shadow-sm';
const CHECK_FACE_UNPRESSED_CLASSNAME = 'border-[1.5px] border-dashed border-neutral-500 bg-white/85';

function rowSlots(row: AlbumRow): GapSlot[] {
  return row.cells.flatMap((cell) => cell.slots);
}

function rowOwnedCount(row: AlbumRow): number {
  return rowSlots(row).filter((slot) => slot.owned).length;
}

function rowTotalCount(row: AlbumRow): number {
  return rowSlots(row).length;
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="text-accent-700 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-within:translate-x-0.5 group-focus-within:opacity-100"
    >
      <path
        d="M3 8h9M8.5 4.5L12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CoinCircle({
  denomination,
  imageUrl,
  faded,
  lifted,
}: {
  denomination: string;
  imageUrl: string | null;
  faded: boolean;
  lifted: boolean;
}) {
  return (
    <span
      data-testid="set-album-card-circle"
      aria-hidden="true"
      className={[
        'relative flex aspect-square w-[58%] items-center justify-center rounded-full border-[3px] border-solid border-neutral-400 bg-neutral-300',
        'transition-transform duration-200 group-hover:scale-105',
        lifted ? 'shadow-md' : '',
        faded ? 'opacity-50 grayscale' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
        <>
          <span className="absolute inset-[7%] rounded-full border border-neutral-800/35" />
          <span
            data-testid="set-album-card-numeral"
            className={`${HEADING_FONT_CLASSNAME} text-[34px] font-semibold leading-none text-neutral-800`}
          >
            {getDenominationNumeral(denomination)}
          </span>
        </>
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
  statusOwned,
  statusMissing,
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
  statusOwned: string;
  statusMissing: string;
}) {
  const { coin, owned } = slot;
  const text = getAlbumCardText(coin);
  const muted = gapOnly && owned;
  // A visitor sees someone else's set: ownership isn't theirs to show, so the card stays neutral.
  const showOwned = isOwner && owned;
  const showMissing = isOwner && !owned;
  const className = [
    CARD_BASE_CLASSNAME,
    showOwned ? CARD_OWNED_CLASSNAME : CARD_MISSING_CLASSNAME,
    muted ? 'opacity-40' : '',
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
      <div className={`${WELL_BASE_CLASSNAME} ${showOwned ? 'bg-accent-200' : 'bg-neutral-200'}`}>
        {coin.isKeyDate && (
          <span data-testid="set-album-card-key-date" className={KEY_DATE_PILL_CLASSNAME}>
            {keyDateBadge}
          </span>
        )}
        <CoinCircle denomination={coin.denomination} imageUrl={coin.imageUrl} faded={showMissing} lifted={showOwned} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 break-words px-3 pb-3 pt-3">
        {text.eyebrow && !hoistedEyebrow && (
          <p data-testid="set-album-card-eyebrow" className="text-xs text-neutral-700">
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
        <p data-testid="set-album-card-secondary" className="text-[13px] text-neutral-700">
          {text.secondary}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span
            data-testid="set-album-card-status"
            className={`text-xs tracking-[0.02em] ${showOwned ? 'font-medium text-accent-700' : 'text-neutral-700'}`}
          >
            {isOwner ? (owned ? statusOwned : statusMissing) : coin.year}
          </span>
          <ArrowIcon />
        </div>
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
          <span
            aria-hidden="true"
            className={`${CHECK_FACE_BASE_CLASSNAME} ${owned ? CHECK_FACE_PRESSED_CLASSNAME : CHECK_FACE_UNPRESSED_CLASSNAME}`}
          >
            <CheckIcon />
          </span>
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
  const statusOwned = t('setAlbum.statusOwned');
  const statusMissing = t('setAlbum.statusMissing');
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
        statusOwned={statusOwned}
        statusMissing={statusMissing}
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
          <span aria-hidden="true" className={`${CIRCLE_BASE_CLASSNAME} h-5 w-5 text-xs ${CIRCLE_OWNED_CLASSNAME}`}>
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
                    <div className="flex items-baseline gap-3">
                      <h3
                        data-testid="set-album-year-label"
                        className={`${HEADING_FONT_CLASSNAME} text-[26px] font-semibold leading-none`}
                      >
                        {row.year}
                      </h3>
                      <span data-testid="set-album-year-summary" className="font-mono text-[13px] text-neutral-700">
                        {rowOwnedCount(row)}/{rowTotalCount(row)}
                      </span>
                      <span aria-hidden="true" className="h-px flex-1 self-center bg-divider" />
                    </div>
                    <ul
                      data-testid="set-album-year-grid"
                      className="grid list-none grid-cols-[repeat(auto-fill,minmax(min(172px,100%),1fr))] gap-3 p-0"
                    >
                      {renderCards(rowSlots(row), hoisted)}
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
                              <ul className="flex list-none flex-col gap-1 p-0">{renderCards(cell.slots, hoisted)}</ul>
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
