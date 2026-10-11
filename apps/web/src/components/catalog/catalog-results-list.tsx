'use client';

import Link from 'next/link';
import type { CatalogCoin } from '@coin-collector/shared';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { getDenominationNumeral } from '@/lib/album-layout';
import { getCatalogRowText, getPaginationItems } from '@/lib/catalog-view';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface CatalogResultsListProps {
  coins: CatalogCoin[];
  isLoading: boolean;
}

export interface CatalogPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// Header and rows share one grid so the Year and Denomination columns line up.
const GRID_CLASS =
  'grid grid-cols-[44px_minmax(0,1fr)_64px_130px_20px] items-center gap-x-4 px-3 max-[720px]:grid-cols-[40px_minmax(0,1fr)_56px_16px]';

function CoinThumbnail({ coin }: { coin: CatalogCoin }) {
  if (coin.imageUrl) {
    return (
      <img
        data-testid="catalog-item-image"
        src={coin.imageUrl}
        alt=""
        loading="lazy"
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-testid="catalog-item-numeral"
      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-neutral-400 bg-neutral-300 font-[family-name:var(--font-heading)] text-[15px] font-semibold text-neutral-800"
    >
      {getDenominationNumeral(coin.denomination)}
    </span>
  );
}

function CatalogRow({ coin }: { coin: CatalogCoin }) {
  const { t } = useTranslation();
  const { title, subtitle, yearLabel } = getCatalogRowText(coin);

  return (
    <li
      data-testid="catalog-item"
      className={`group relative ${GRID_CLASS} border-b border-[color-mix(in_srgb,var(--color-divider)_75%,transparent)] py-2 last:border-b-0 hover:bg-surface`}
    >
      <CoinThumbnail coin={coin} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          data-testid="catalog-item-link"
          href={`/catalog/${coin.id}`}
          className="truncate text-[15px] font-medium text-text outline-none after:absolute after:inset-0 after:rounded-[4px] after:content-[''] group-hover:text-accent-700 group-hover:underline focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent-700"
        >
          {title}
        </Link>
        {(subtitle !== '' || coin.isKeyDate) && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {subtitle !== '' && (
              <span data-testid="catalog-item-variety" className="truncate text-xs text-neutral-700">
                {subtitle}
              </span>
            )}
            {coin.isKeyDate && (
              <span
                data-testid="catalog-item-key-date"
                className="rounded-[4px] bg-accent-800 px-1.5 py-px text-[11px] text-accent-100"
              >
                {t('catalog.keyDateBadge')}
              </span>
            )}
          </div>
        )}
      </div>
      <span data-testid="catalog-item-year" className="font-mono text-sm tabular-nums text-text">
        {yearLabel}
      </span>
      <span data-testid="catalog-item-denomination" className="truncate text-sm text-neutral-800 max-[720px]:hidden">
        {coin.denomination}
      </span>
      <span aria-hidden="true" className="text-base text-neutral-500">
        ›
      </span>
    </li>
  );
}

export default function CatalogResultsList({ coins, isLoading }: CatalogResultsListProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-[7px] border border-neutral-300 bg-neutral-100 pt-2.5">
      <div
        aria-hidden="true"
        className={`${GRID_CLASS} border-b border-divider pb-2 text-[12px] font-medium uppercase tracking-[0.04em] text-neutral-700`}
      >
        <span className="col-span-2">{t('catalog.colCoin')}</span>
        <span>{t('catalog.colYear')}</span>
        <span className="max-[720px]:hidden">{t('catalog.colDenomination')}</span>
        <span />
      </div>
      {isLoading ? (
        <div data-testid="catalog-loading" className="p-3">
          <ListSkeleton />
        </div>
      ) : (
        <ul data-testid="catalog-results" className="flex flex-col">
          {coins.map((coin) => (
            <CatalogRow key={coin.id} coin={coin} />
          ))}
        </ul>
      )}
    </div>
  );
}

function fillPageOf(template: string, page: number, total: number) {
  // Numbers render in mono; the words around them stay translatable.
  return template.split(/(\{page\}|\{total\})/).map((part, index) => {
    if (part === '{page}' || part === '{total}') {
      return (
        <span key={index} className="font-mono tabular-nums">
          {part === '{page}' ? page : total}
        </span>
      );
    }
    return part;
  });
}

const PAGE_BUTTON_CLASS =
  'flex h-10 min-w-10 items-center justify-center rounded-[4px] px-2 font-mono text-sm tabular-nums';

export function CatalogPagination({ page, totalPages, onPageChange }: CatalogPaginationProps) {
  const { t } = useTranslation();
  const total = Math.max(1, totalPages);
  const isFirst = page <= 1;
  const isLast = page >= total;

  return (
    <nav
      aria-label="Pagination"
      data-testid="catalog-pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <span data-testid="catalog-pagination-summary" className="text-[13px] text-neutral-700">
        {fillPageOf(t('catalog.pageOf'), page, total)}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          data-testid="catalog-pagination-prev"
          aria-label={t('catalog.prevPage')}
          disabled={isFirst}
          onClick={() => onPageChange(page - 1)}
          className={`${PAGE_BUTTON_CLASS} border border-neutral-300 ${
            isFirst ? 'cursor-not-allowed text-neutral-400' : 'text-text hover:border-accent-700 hover:text-accent-700'
          }`}
        >
          ‹
        </button>
        {getPaginationItems(page, total).map((item, index) => {
          if (item === 'ellipsis') {
            return (
              <span
                key={`ellipsis-${index}`}
                aria-hidden="true"
                data-testid="catalog-pagination-ellipsis"
                className={`${PAGE_BUTTON_CLASS} text-neutral-700`}
              >
                …
              </span>
            );
          }
          if (item === page) {
            return (
              <span
                key={item}
                aria-current="page"
                data-testid="catalog-pagination-page"
                className={`${PAGE_BUTTON_CLASS} bg-accent-700 text-white`}
              >
                {item}
              </span>
            );
          }
          return (
            <button
              key={item}
              type="button"
              data-testid="catalog-pagination-page"
              onClick={() => onPageChange(item)}
              className={`${PAGE_BUTTON_CLASS} text-text hover:bg-surface hover:text-accent-700`}
            >
              {item}
            </button>
          );
        })}
        <button
          type="button"
          data-testid="catalog-pagination-next"
          aria-label={t('catalog.nextPage')}
          disabled={isLast}
          onClick={() => onPageChange(page + 1)}
          className={`${PAGE_BUTTON_CLASS} border border-neutral-300 ${
            isLast ? 'cursor-not-allowed text-neutral-400' : 'text-text hover:border-accent-700 hover:text-accent-700'
          }`}
        >
          ›
        </button>
      </div>
    </nav>
  );
}
