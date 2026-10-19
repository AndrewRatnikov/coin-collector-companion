'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { formatCoinLabel, getCoinName } from '@coin-collector/shared';
import { useCoin } from '@/lib/hooks/use-catalog';
import { useCollection, useSetOwnership, type SetOwnershipVariables } from '@/lib/hooks/use-collection';
import { useAddCoinsToSet, useUserSets } from '@/lib/hooks/use-user-sets';
import { getSetGaps } from '@/lib/user-sets-api';
import { getStoredToken } from '@/lib/auth-token';
import { catalogCountryHref, getCoinSetRows, getCoinSpecRows, type CoinSpecKey } from '@/lib/coin-page';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import type { StatusToggleState } from '@/components/ui/status-toggle';
import { CoinOwnershipPanel } from '@/components/catalog/coin-ownership-panel';
import { AddToSetMenu, type AddToSetMenuSet } from '@/components/catalog/add-to-set-menu';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';
import type { MessageKey } from '@/lib/i18n/locales/en';

function fill(template: string, values: Record<string, string | number>): string {
  let text = template;
  for (const [key, value] of Object.entries(values)) {
    text = text.split(`{${key}}`).join(String(value));
  }
  return text;
}

function withId(ids: ReadonlySet<string>, id: string, present: boolean): ReadonlySet<string> {
  if (ids.has(id) === present) return ids;
  const next = new Set(ids);
  if (present) next.add(id);
  else next.delete(id);
  return next;
}

const SPEC_LABEL_KEYS: Record<CoinSpecKey, MessageKey> = {
  diameter: 'coinDetail.diameter',
  weight: 'coinDetail.weight',
  thickness: 'coinDetail.thickness',
  material: 'coinDetail.material',
  mintage: 'coinDetail.mintage',
  mintMark: 'common.mintMark',
};

const SPEC_TEST_IDS: Record<CoinSpecKey, string> = {
  diameter: 'coin-detail-diameter',
  weight: 'coin-detail-weight',
  thickness: 'coin-detail-thickness',
  material: 'coin-detail-material',
  mintage: 'coin-detail-mintage',
  mintMark: 'coin-detail-mint-mark',
};

// Main's side padding, reused (negated) so the mobile ownership bar bleeds to the screen edges.
const MAIN_PADDING = 'px-[clamp(20px,5vw,48px)]';
const BAR_BLEED = '-mx-[clamp(20px,5vw,48px)]';

const SECTION_HEADING = 'text-[13px] font-semibold uppercase tracking-[.08em] text-neutral-700';

export default function CoinDetailPage({ params }: { params: Promise<{ coinId: string }> }) {
  const { t, locale } = useTranslation();
  const [coinId, setCoinId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => {
      if (!cancelled) setCoinId(resolved.coinId);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const { data: coin, isLoading, isError } = useCoin(coinId ?? '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getStoredToken()));
  }, []);

  const coinName = coin ? getCoinName(coin) : null;
  const coinTitle = coinName?.title ?? '';

  // One polite live region for the page: ownership saves and set adds both announce here.
  const [liveMessage, setLiveMessage] = useState('');

  // Both are authenticated endpoints: gate them on isLoggedIn so an anonymous visitor
  // doesn't fire two requests that can only 401 on this public page.
  const { data: collection } = useCollection({}, { enabled: isLoggedIn });
  const ownership = useSetOwnership({
    onSettled: (error: Error | null, vars: SetOwnershipVariables) => {
      if (vars.coinId !== coinId) return;
      let key: MessageKey;
      if (error) key = 'coinDetail.liveFailed';
      else key = vars.owned ? 'coinDetail.liveOwned' : 'coinDetail.liveRemoved';
      setLiveMessage(fill(t(key), { title: coinTitle }));
    },
  });
  const addToSet = useAddCoinsToSet();
  const { data: userSets } = useUserSets({ enabled: isLoggedIn });

  const setsToCheck = isLoggedIn ? (userSets ?? []) : [];
  const gapQueries = useQueries({
    queries: setsToCheck.map((set) => ({
      queryKey: ['user-sets', set.id, 'gaps'],
      queryFn: () => getSetGaps(set.id),
      enabled: isLoggedIn,
    })),
  });

  // The value the last toggle asked for, so Try again re-issues that same change after the rollback.
  const lastTargetRef = useRef<boolean | null>(null);
  const [addingSetIds, setAddingSetIds] = useState<ReadonlySet<string>>(() => new Set());
  const [addedSetIds, setAddedSetIds] = useState<ReadonlySet<string>>(() => new Set());

  if (coinId === null) {
    return <main data-testid="coin-detail-page" />;
  }
  const currentCoinId = coinId;

  const owned = collection?.some((item) => item.coinId === currentCoinId) ?? false;
  const pending = ownership.isPending;
  const failed = ownership.failedCoinIds.has(currentCoinId);
  const ownershipState: StatusToggleState = pending ? 'pending' : failed ? 'failed' : 'idle';
  const plateOwned = isLoggedIn && owned;

  function handleToggle() {
    const target = !owned;
    lastTargetRef.current = target;
    ownership.mutate({ coinId: currentCoinId, owned: target });
  }

  function handleRetry() {
    ownership.mutate({ coinId: currentCoinId, owned: lastTargetRef.current ?? !owned });
  }

  const setRows = getCoinSetRows(
    setsToCheck.map((set) => ({ id: set.id, name: resolveLocalizedText(set.name, locale) })),
    gapQueries.map((query) => query.data),
    currentCoinId,
  );
  const containingRows = setRows.filter((row) => row.containsCoin);
  const menuSets: AddToSetMenuSet[] = setRows.map((row) => {
    let status: AddToSetMenuSet['status'];
    if (row.containsCoin || addedSetIds.has(row.id)) status = 'added';
    else if (addingSetIds.has(row.id)) status = 'adding';
    else if (!row.loaded) status = 'loading';
    else status = 'available';
    return { id: row.id, name: row.name, status };
  });

  function handleAdd(setId: string) {
    const setName = setRows.find((row) => row.id === setId)?.name ?? '';
    setAddingSetIds((ids) => withId(ids, setId, true));
    addToSet
      .mutateAsync({ setId, coinIds: [currentCoinId] })
      .then(() => {
        setAddedSetIds((ids) => withId(ids, setId, true));
        setLiveMessage(fill(t('coinDetail.liveAddedToSet'), { title: coinTitle, set: setName }));
      })
      .catch(() => {
        setLiveMessage(fill(t('coinDetail.liveAddFailed'), { title: coinTitle, set: setName }));
      })
      .finally(() => {
        setAddingSetIds((ids) => withId(ids, setId, false));
      });
  }

  const addToSetMenu = <AddToSetMenu coinTitle={coinTitle} sets={menuSets} onAdd={handleAdd} />;
  const showBar = isLoggedIn && Boolean(coin);
  const specRows = coin ? getCoinSpecRows(coin, locale) : [];

  return (
    <main
      data-testid="coin-detail-page"
      className={`mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 ${MAIN_PADDING} py-6${showBar ? ' max-[899px]:pb-0' : ''}`}
    >
      <nav
        aria-label={t('coinDetail.breadcrumbLabel')}
        data-testid="coin-detail-breadcrumb"
        className="flex flex-wrap gap-1.5 text-[13px] text-neutral-700"
      >
        <Link
          href="/catalog"
          data-testid="coin-detail-breadcrumb-catalog"
          className="underline-offset-2 hover:text-accent-700 hover:underline"
        >
          {t('catalog.title')}
        </Link>
        {coin && (
          <>
            <span aria-hidden="true">/</span>
            <Link
              href={catalogCountryHref(coin.country)}
              data-testid="coin-detail-breadcrumb-country"
              className="underline-offset-2 hover:text-accent-700 hover:underline"
            >
              {resolveLocalizedText(coin.country, locale)}
            </Link>
          </>
        )}
        {coinName && coinName.eyebrow !== '' && (
          <>
            <span aria-hidden="true">/</span>
            <span data-testid="coin-detail-breadcrumb-series" className="text-neutral-800 [overflow-wrap:anywhere]">
              {coinName.eyebrow}
            </span>
          </>
        )}
      </nav>

      {isLoading && (
        <div
          data-testid="coin-detail-loading"
          className="grid grid-cols-1 items-start gap-10 min-[900px]:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]"
        >
          <Skeleton className="aspect-square w-full" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-5 w-56" />
          </div>
        </div>
      )}

      {isError && (
        <p data-testid="coin-detail-error" className="text-sm text-[color:var(--color-accent-800)]">
          {t('coinDetail.errorLoading')}
        </p>
      )}

      {coin && (
        <div className="grid grid-cols-1 items-start gap-10 min-[900px]:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
          <figure
            data-testid="coin-detail-plate"
            data-owned={plateOwned ? 'true' : 'false'}
            className="flex flex-col gap-2"
          >
            <div
              className={`relative @container flex aspect-square w-full items-center justify-center rounded-[var(--radius-lg)] border motion-safe:transition-colors ${
                plateOwned ? 'border-accent-400 bg-accent-200' : 'border-neutral-300 bg-neutral-200'
              }`}
            >
              {coin.isKeyDate && (
                <span data-testid="coin-detail-key-date-badge" className="absolute left-4 top-4">
                  <Badge variant="key-date">★ {t('coinDetail.keyDateBadge')}</Badge>
                </span>
              )}
              {coin.imageUrl ? (
                <span
                  role="img"
                  aria-label={formatCoinLabel(coin)}
                  data-testid="coin-detail-image"
                  className="inline-flex items-center justify-center"
                >
                  <PlaceholderCoin
                    denomination={coin.denomination}
                    material={coin.material}
                    size="fluid"
                    imageUrl={coin.imageUrl}
                  />
                </span>
              ) : (
                <PlaceholderCoin denomination={coin.denomination} material={coin.material} size="fluid" />
              )}
            </div>
            <figcaption className="text-xs text-neutral-700">
              {coin.imageUrl ? (
                <p data-testid="coin-detail-attribution">
                  {t('coinDetail.imageAttributionPrefix')} {coin.imageSource ?? t('coinDetail.unknownSource')}
                  {coin.imageLicense ? `, ${coin.imageLicense}` : ''}
                </p>
              ) : (
                <p data-testid="coin-detail-plate-caption">{t('coinDetail.placeholderCaption')}</p>
              )}
            </figcaption>
          </figure>

          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-2">
              {coinName && coinName.eyebrow !== '' && (
                <p data-testid="coin-detail-eyebrow" className="text-[13px] font-medium text-neutral-700">
                  {coinName.eyebrow}
                </p>
              )}
              <h1
                data-testid="coin-detail-label"
                className="font-[family-name:var(--font-heading)] text-[36px] font-semibold leading-[1.05] text-text [overflow-wrap:anywhere] min-[900px]:text-[48px]"
              >
                {coinName?.title}
              </h1>
              <p data-testid="coin-detail-subtitle" className="text-base text-neutral-800">
                {coinName?.subtitle}
              </p>
              {coin.status !== 'approved' && (
                <span
                  data-testid="coin-detail-pending-badge"
                  className="w-fit rounded-[2px] bg-[color:var(--color-accent-100)] px-2 py-1 text-xs font-medium text-[color:var(--color-accent-800)]"
                >
                  {t('coinDetail.pendingBadge')}
                </span>
              )}
            </div>

            {isLoggedIn ? (
              <CoinOwnershipPanel
                layout="panel"
                coinTitle={coinTitle}
                owned={owned}
                state={ownershipState}
                onToggle={handleToggle}
                onRetry={handleRetry}
              />
            ) : (
              <p data-testid="coin-detail-login-prompt" className="text-sm text-neutral-700">
                {t('coinDetail.loginPrompt')}
              </p>
            )}

            {isLoggedIn &&
              (containingRows.length > 0 ? (
                <section
                  data-testid="coin-detail-sets"
                  aria-labelledby="coin-detail-sets-heading"
                  className="flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="coin-detail-sets-heading" className={SECTION_HEADING}>
                      {t('coinDetail.inYourSets')}
                    </h2>
                    {addToSetMenu}
                  </div>
                  <ul
                    data-testid="coin-detail-sets-list"
                    className="flex flex-col divide-y divide-neutral-200 rounded-[var(--radius-lg)] border border-neutral-300 bg-white"
                  >
                    {containingRows.map((row) => {
                      const progressText = fill(t('coinDetail.setProgress'), {
                        owned: row.ownedCount,
                        total: row.totalCount,
                        pct: row.percent,
                      });
                      return (
                        <li
                          key={row.id}
                          data-testid="coin-detail-set-item"
                          className="grid grid-cols-1 items-center gap-2 px-4 py-3 min-[900px]:grid-cols-[minmax(0,1fr)_180px] min-[900px]:gap-4"
                        >
                          <Link
                            href={`/sets/${row.id}`}
                            data-testid="coin-detail-set-link"
                            className="min-w-0 text-[15px] font-medium text-text [overflow-wrap:anywhere] hover:text-accent-700 hover:underline"
                          >
                            {row.name}
                          </Link>
                          <div className="flex flex-col gap-1">
                            <div
                              role="progressbar"
                              aria-valuenow={row.percent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${row.name}: ${progressText}`}
                              data-testid="coin-detail-set-progress"
                              className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-300"
                            >
                              <div
                                className="h-full rounded-full bg-accent motion-safe:transition-[width]"
                                style={{ width: `${row.percent}%` }}
                              />
                            </div>
                            <span
                              data-testid="coin-detail-set-progress-label"
                              className="font-mono text-xs tabular-nums text-neutral-700"
                            >
                              {progressText}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : (
                addToSetMenu
              ))}

            <section aria-labelledby="coin-detail-specs-heading" className="flex flex-col gap-3">
              <h2 id="coin-detail-specs-heading" className={SECTION_HEADING}>
                {t('coinDetail.specifications')}
              </h2>
              <table data-testid="coin-detail-specs" className="w-full border-collapse text-sm">
                <tbody>
                  {specRows.map((row) => (
                    <tr key={row.key} className="border-b border-[var(--color-divider)] first:border-t">
                      <th scope="row" className="py-2.5 pr-4 text-left font-normal text-neutral-700">
                        {t(SPEC_LABEL_KEYS[row.key])}
                      </th>
                      {row.value === null ? (
                        <td data-testid={SPEC_TEST_IDS[row.key]} className="italic text-neutral-700 py-2.5 text-right">
                          {t('coinDetail.notRecorded')}
                        </td>
                      ) : (
                        <td
                          data-testid={SPEC_TEST_IDS[row.key]}
                          className="font-mono tabular-nums py-2.5 text-right text-text [overflow-wrap:anywhere]"
                        >
                          {row.value}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p data-testid="coin-detail-specs-attribution" className="text-xs text-neutral-700">
                {t('footer.attributionPrefix')}{' '}
                <a
                  href="https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-accent-700"
                >
                  {t('footer.wikipediaLinkText')}
                </a>
                {t('footer.attributionSuffix')}
              </p>
            </section>
          </div>
        </div>
      )}

      <p data-testid="coin-detail-live" role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {showBar && (
        <CoinOwnershipPanel
          layout="bar"
          coinTitle={coinTitle}
          owned={owned}
          state={ownershipState}
          onToggle={handleToggle}
          onRetry={handleRetry}
          className={BAR_BLEED}
        />
      )}
    </main>
  );
}
