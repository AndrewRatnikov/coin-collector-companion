'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CatalogCoin, CatalogSort } from '@coin-collector/shared';
import { Sheet } from '@/components/ui/sheet';
import CatalogFilterSidebar, { type CatalogFilterSidebarProps } from '@/components/catalog/catalog-filter-sidebar';
import CatalogResultsList, { CatalogPagination } from '@/components/catalog/catalog-results-list';
import SubmitCoinForm from '@/components/catalog/submit-coin-form';
import SubmissionConfirmation from '@/components/catalog/submission-confirmation';
import { useCatalog, useCatalogFacets } from '@/lib/hooks/use-catalog';
import {
  CATALOG_PAGE_SIZE,
  EMPTY_CATALOG_VIEW_STATE,
  catalogViewStateToFilters,
  catalogViewStateToSearchParams,
  countActiveFilters,
  parseCatalogSearchParams,
  type CatalogViewState,
} from '@/lib/catalog-view';
import { getStoredToken } from '@/lib/auth-token';
import { useTranslation } from '@/lib/i18n/i18n-context';

const SEARCH_DEBOUNCE_MS = 300;

function fillCount(template: string, count: number): string {
  return template.split('{count}').join(String(count));
}

// useSearchParams in a prerendered client page needs a Suspense boundary for `next build`.
export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <CatalogPageContent />
    </Suspense>
  );
}

function CatalogPageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();

  // Local state is the source of truth after mount; the URL mirrors it.
  const [view, setView] = useState<CatalogViewState>(() => parseCatalogSearchParams(searchParams));
  const [searchText, setSearchText] = useState(() => view.name);
  const viewRef = useRef(view);
  viewRef.current = view;

  // The URL is re-parsed only when the searchParams value itself changes, and not when it
  // merely catches up with what this page just wrote (router.replace below). That covers
  // outside navigation such as the nav "Catalog" link without ever reverting a local change.
  const seenSearchRef = useRef(searchString);
  const writtenSearchRef = useRef<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (searchString !== seenSearchRef.current) {
    seenSearchRef.current = searchString;
    if (searchString !== writtenSearchRef.current) {
      const next = parseCatalogSearchParams(searchParams);
      viewRef.current = next;
      setView(next);
      setSearchText(next.name);
    }
  }

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAddCoinSheetOpen, setIsAddCoinSheetOpen] = useState(false);
  const [submittedCoin, setSubmittedCoin] = useState<CatalogCoin | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getStoredToken()));
  }, []);

  useEffect(
    () => () => {
      if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  const filters = useMemo(() => catalogViewStateToFilters(view, isLoggedIn), [view, isLoggedIn]);
  const { data, isLoading, isError } = useCatalog(filters);
  const { data: facets } = useCatalogFacets(view.country || undefined);

  function update(next: CatalogViewState) {
    viewRef.current = next;
    setView(next);
    const qs = catalogViewStateToSearchParams(next).toString();
    writtenSearchRef.current = qs;
    router.replace(qs ? `/catalog?${qs}` : '/catalog', { scroll: false });
  }

  function cancelSearchTimer() {
    if (searchTimerRef.current !== null) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setSearchText(text);
    cancelSearchTimer();
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null;
      const name = text.trim();
      const current = viewRef.current;
      if (name !== current.name) update({ ...current, name, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
  }

  const handleSidebarChange: CatalogFilterSidebarProps['onChange'] = (patch) => {
    update({ ...viewRef.current, ...patch, page: 1 });
  };

  function handleClearAll() {
    cancelSearchTimer();
    setSearchText('');
    update({ ...EMPTY_CATALOG_VIEW_STATE, sort: viewRef.current.sort });
  }

  function handleSortChange(event: ChangeEvent<HTMLSelectElement>) {
    update({ ...viewRef.current, sort: event.target.value as CatalogSort, page: 1 });
  }

  function handlePageChange(page: number) {
    update({ ...viewRef.current, page });
  }

  function openAddCoinSheet() {
    setIsAddCoinSheetOpen(true);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / CATALOG_PAGE_SIZE)) : 1;
  const countText = data ? fillCount(t('catalog.coinCount'), data.total) : '';

  const sidebarProps = {
    state: view,
    facets,
    isLoggedIn,
    onChange: handleSidebarChange,
    onClearAll: handleClearAll,
  };

  return (
    <main
      data-testid="catalog-page"
      className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-[family-name:var(--font-heading)] text-[36px] font-semibold leading-[1.1] text-text">
            {t('catalog.title')}
          </h1>
          {data && (
            <span data-testid="catalog-count" className="font-mono text-sm tabular-nums text-neutral-700">
              {countText}
            </span>
          )}
        </div>
        {isLoggedIn && (
          <button
            type="button"
            data-testid="catalog-submit-coin-toggle"
            onClick={openAddCoinSheet}
            className="text-sm text-accent-700 underline underline-offset-2 hover:text-accent-800"
          >
            {t('catalog.addCoinCta')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <aside
          aria-label={t('catalog.filtersHeading')}
          data-testid="catalog-sidebar"
          className="flex-[0_0_236px] rounded-[7px] bg-surface p-[18px] max-[720px]:hidden"
        >
          <CatalogFilterSidebar idPrefix="catalog-sidebar" {...sidebarProps} />
        </aside>

        <section aria-label={t('catalog.resultsLabel')} className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-testid="catalog-filters-button"
              aria-expanded={filtersOpen}
              aria-controls="catalog-filters-sheet"
              onClick={() => setFiltersOpen(true)}
              className="hidden h-[42px] items-center rounded-[4px] border border-neutral-400 bg-white px-4 text-sm text-text max-[720px]:inline-flex"
            >
              {fillCount(t('catalog.filtersButton'), countActiveFilters(view, isLoggedIn))}
            </button>
            <div className="relative flex-[1_1_240px]">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5 14 14" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                data-testid="catalog-search"
                aria-label={t('catalog.searchLabel')}
                placeholder={t('catalog.searchPlaceholder')}
                value={searchText}
                onChange={handleSearchChange}
                className="h-[42px] w-full rounded-[4px] border border-neutral-300 bg-white pl-9 pr-3 text-sm text-text outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-200"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              {t('catalog.sortLabel')}
              <select
                data-testid="catalog-sort"
                value={view.sort}
                onChange={handleSortChange}
                className="h-[42px] rounded-[4px] border border-neutral-300 bg-white px-3 text-sm text-text outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-200"
              >
                <option value="year_asc">{t('catalog.sortYearAsc')}</option>
                <option value="year_desc">{t('catalog.sortYearDesc')}</option>
                <option value="name_asc">{t('catalog.sortNameAsc')}</option>
              </select>
            </label>
          </div>

          {isError ? (
            <p data-testid="catalog-error" className="text-sm text-[color:var(--color-accent-800)]">
              {t('catalog.errorLoading')}
            </p>
          ) : data && data.items.length === 0 ? (
            <div
              data-testid="catalog-empty"
              className="flex flex-col items-center gap-3 rounded-[7px] bg-surface px-6 py-10 text-center"
            >
              <p className="text-sm text-text">{t('catalog.noMatches')}</p>
              <button
                type="button"
                data-testid="catalog-empty-clear"
                onClick={handleClearAll}
                className="text-sm text-accent-700 underline underline-offset-2"
              >
                {t('catalog.clearAllFilters')}
              </button>
              {isLoggedIn && (
                <button
                  type="button"
                  data-testid="catalog-empty-add-coin"
                  onClick={openAddCoinSheet}
                  className="text-sm text-accent-700 underline underline-offset-2"
                >
                  {t('catalog.addThisCoin')}
                </button>
              )}
            </div>
          ) : (
            <>
              <CatalogResultsList
                coins={data?.items ?? []}
                isLoading={isLoading && !data}
                showOwnership={isLoggedIn}
              />
              {data && data.items.length > 0 && (
                <CatalogPagination page={view.page} totalPages={totalPages} onPageChange={handlePageChange} />
              )}
            </>
          )}

          <p data-testid="catalog-live-region" aria-live="polite" className="sr-only">
            {countText}
          </p>
        </section>
      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('catalog.filtersHeading')}>
        <div id="catalog-filters-sheet" data-testid="catalog-filters-sheet">
          <CatalogFilterSidebar idPrefix="catalog-sheet" showHeading={false} {...sidebarProps} />
        </div>
      </Sheet>

      <Sheet
        open={isAddCoinSheetOpen}
        onClose={() => {
          setIsAddCoinSheetOpen(false);
          setSubmittedCoin(null);
        }}
        title={t('catalog.addCoinSheetTitle')}
      >
        {submittedCoin ? (
          <SubmissionConfirmation coin={submittedCoin} />
        ) : (
          <SubmitCoinForm onSuccess={(coin) => setSubmittedCoin(coin)} />
        )}
      </Sheet>
    </main>
  );
}
