'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { GapSlot } from '@coin-collector/shared';
import {
  buildAlbumLayout,
  formatAlbumCoinName,
  formatAlbumSlotLabel,
  formatOwnedOfTotal,
  type AlbumSlotLabelWords,
} from '@/lib/album-layout';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SetAlbumProps {
  slots: GapSlot[];
  isOwner: boolean;
  gapOnly: boolean;
  onToggle: (coinId: string, currentlyOwned: boolean) => void;
  pendingCoinId?: string | null;
}

const STICKY_YEAR_CLASSNAME =
  'sticky left-0 z-10 bg-bg border-r border-divider px-2 py-1 text-left text-sm font-semibold';

const BLANK_CELL_CLASSNAME =
  'min-w-12 border border-transparent bg-[repeating-linear-gradient(45deg,var(--color-neutral-200)_0_4px,transparent_4px_8px)] px-1 py-1';

const SLOT_BASE_CLASSNAME =
  'inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded px-1 text-sm';
const SLOT_OWNED_CLASSNAME = 'border border-accent bg-accent text-white';
const SLOT_MISSING_CLASSNAME = 'border border-dashed border-neutral-500 bg-transparent text-neutral-700';

const CATALOG_LINK_CLASSNAME =
  'inline-flex min-h-8 min-w-8 items-center justify-center rounded text-xs text-neutral-600 hover:underline';

function AlbumSlot({
  slot,
  isOwner,
  gapOnly,
  onToggle,
  pending,
  words,
  viewInCatalog,
}: {
  slot: GapSlot;
  isOwner: boolean;
  gapOnly: boolean;
  onToggle: (coinId: string, currentlyOwned: boolean) => void;
  pending: boolean;
  words: AlbumSlotLabelWords;
  viewInCatalog: string;
}) {
  const { coin } = slot;
  const label = formatAlbumSlotLabel(slot, words);
  const muted = gapOnly && slot.owned;
  const className = [
    SLOT_BASE_CLASSNAME,
    slot.owned ? SLOT_OWNED_CLASSNAME : SLOT_MISSING_CLASSNAME,
    muted ? 'opacity-40' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const sharedProps = {
    'aria-label': label,
    title: label,
    'data-coin-id': coin.id,
    'data-owned': slot.owned ? 'true' : 'false',
    'data-key-date': coin.isKeyDate ? 'true' : 'false',
    'data-muted': muted ? 'true' : 'false',
    'aria-busy': pending ? true : undefined,
    className,
  } as const;

  const children = (
    <>
      <span aria-hidden="true">{slot.owned ? '✓' : '○'}</span>
      {coin.isKeyDate && (
        <span data-testid="set-album-key-date-marker" aria-hidden="true">
          ★
        </span>
      )}
      {coin.variety && (
        <span data-testid="set-album-slot-variety" className="max-w-[7rem] truncate text-xs">
          {coin.variety}
        </span>
      )}
    </>
  );

  return (
    <span className="inline-flex items-center gap-0.5">
      {isOwner ? (
        <button
          type="button"
          data-testid="set-album-slot"
          onClick={() => onToggle(coin.id, slot.owned)}
          {...sharedProps}
        >
          {children}
        </button>
      ) : (
        <Link href={`/catalog/${coin.id}`} data-testid="set-album-slot" {...sharedProps}>
          {children}
        </Link>
      )}
      <Link
        href={`/catalog/${coin.id}`}
        data-testid="set-album-slot-catalog-link"
        aria-label={`${viewInCatalog}: ${formatAlbumCoinName(coin)}`}
        className={CATALOG_LINK_CLASSNAME}
      >
        <span aria-hidden="true">↗</span>
      </Link>
    </span>
  );
}

export function SetAlbum({ slots, isOwner, gapOnly, onToggle, pendingCoinId }: SetAlbumProps) {
  const { t } = useTranslation();
  const pages = useMemo(() => buildAlbumLayout(slots), [slots]);

  if (slots.length === 0) {
    return (
      <div data-testid="set-album" className="flex flex-col gap-6">
        <p data-testid="set-album-empty" className="text-sm text-neutral-600">
          {t('setAlbum.empty')}
        </p>
      </div>
    );
  }

  const words: AlbumSlotLabelWords = {
    owned: t('common.owned'),
    missing: t('common.missing'),
    keyDate: t('setAlbum.keyDate'),
  };
  const viewInCatalog = t('setAlbum.viewInCatalog');
  const noMintMark = t('setAlbum.noMintMark');

  return (
    <div data-testid="set-album" className="flex min-w-0 flex-col gap-6">
      <ul
        data-testid="set-album-legend"
        aria-label={t('setAlbum.legendLabel')}
        className="flex flex-wrap items-center gap-4 text-sm text-neutral-700"
      >
        <li className="flex items-center gap-1">
          <span aria-hidden="true" className={`${SLOT_BASE_CLASSNAME} ${SLOT_OWNED_CLASSNAME}`}>
            ✓
          </span>
          {t('setAlbum.legendOwned')}
        </li>
        <li className="flex items-center gap-1">
          <span aria-hidden="true" className={`${SLOT_BASE_CLASSNAME} ${SLOT_MISSING_CLASSNAME}`}>
            ○
          </span>
          {t('setAlbum.legendMissing')}
        </li>
        <li className="flex items-center gap-1">
          <span aria-hidden="true">★</span>
          {t('setAlbum.legendKeyDate')}
        </li>
        <li className="flex items-center gap-1">
          <span aria-hidden="true" className={`inline-block h-8 w-8 ${BLANK_CELL_CLASSNAME}`} />
          {t('setAlbum.legendBlank')}
        </li>
      </ul>

      {pages.map((page, pageIndex) => {
        const headingId = `set-album-page-heading-${pageIndex}`;
        return (
          <section
            key={page.key}
            data-testid="set-album-page"
            aria-labelledby={headingId}
            className="flex min-w-0 flex-col gap-2"
          >
            <h2 data-testid="set-album-page-heading" id={headingId} className="text-base font-semibold">
              {`${page.name} · ${page.country}`}
            </h2>
            <p data-testid="set-album-page-count" className="text-sm text-neutral-600">
              {formatOwnedOfTotal(t('setAlbum.ownedOfTotal'), page.ownedCount, page.totalCount)}
            </p>
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
                        {column.mintMark === '' ? (
                          <span aria-label={noMintMark} title={noMintMark}>
                            —
                          </span>
                        ) : (
                          column.mintMark
                        )}
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
                            className="border-b border-divider px-1 py-1 align-top"
                          >
                            <div className="flex flex-wrap gap-1">
                              {cell.slots.map((slot) => (
                                <AlbumSlot
                                  key={slot.id}
                                  slot={slot}
                                  isOwner={isOwner}
                                  gapOnly={gapOnly}
                                  onToggle={onToggle}
                                  pending={pendingCoinId != null && pendingCoinId === slot.coin.id}
                                  words={words}
                                  viewInCatalog={viewInCatalog}
                                />
                              ))}
                            </div>
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
          </section>
        );
      })}
    </div>
  );
}
