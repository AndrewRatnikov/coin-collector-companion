'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CreateSetRequestBody } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useCanonicalSet, useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSet, usePublicSets } from '@/lib/hooks/use-public-sets';
import { useCreateSet } from '@/lib/hooks/use-user-sets';
import { getAlbumCardText, getDenominationNumeral } from '@/lib/album-layout';
import {
  buildCoinPreview,
  formatYearRange,
  summarizeSourceCoins,
  type SourceCoinItem,
} from '@/lib/new-set-preview';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

type Step = 1 | 2;
type StartOption = 'canonical' | 'public' | 'blank';

const OPTIONS: StartOption[] = ['canonical', 'public', 'blank'];

const OPTION_TEXT_KEYS = {
  canonical: {
    title: 'setNew.optionCanonicalTitle',
    description: 'setNew.optionCanonicalDescription',
  },
  public: { title: 'setNew.optionPublicTitle', description: 'setNew.optionPublicDescription' },
  blank: { title: 'setNew.optionBlankTitle', description: 'setNew.optionBlankDescription' },
} as const;

const PUBLIC_LIST_FILTERS = { page: 1, limit: 100 };

const HEADING_FONT = 'font-[family-name:var(--font-heading)]';
const INPUT_CLASS =
  'rounded-[var(--radius-md)] border border-neutral-400 bg-white px-3 text-sm focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-200';
const CHIP_CLASS = 'rounded-[var(--radius-md)] bg-surface px-2 py-0.5 font-mono text-xs';
const SUBHEADING_CLASS = 'text-xs font-semibold uppercase tracking-[0.06em] text-neutral-800';
const PRIMARY_BUTTON_CLASS =
  'rounded-[var(--radius-md)] bg-accent-700 px-5 text-sm font-semibold text-white hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-70';

function fillCount(template: string, count: number): string {
  return template.split('{count}').join(String(count));
}

interface EntryParams {
  cloneFrom: 'canonical' | 'user' | null;
  cloneFromId: string;
}

function readEntry(searchParams: { get(name: string): string | null }): EntryParams {
  const raw = searchParams.get('cloneFrom');
  const cloneFrom = raw === 'canonical' || raw === 'user' ? raw : null;
  return { cloneFrom, cloneFromId: cloneFrom ? (searchParams.get('cloneFromId') ?? '') : '' };
}

/** The step-2 source detail, normalised over the canonical and public shapes. */
interface SourceDetail {
  name: string;
  description: string | null;
  coins: SourceCoinItem[];
}

function NewSetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();

  // The entry URL is read once: it decides the starting step and where Cancel goes.
  const [entry] = useState<EntryParams>(() => readEntry(searchParams));
  const entryHasId = entry.cloneFrom !== null && entry.cloneFromId !== '';
  const entryOption: StartOption = entry.cloneFrom === 'user' ? 'public' : 'canonical';

  const [step, setStep] = useState<Step>(entryHasId ? 2 : 1);
  const [option, setOption] = useState<StartOption>(entryOption);
  const [sourceId, setSourceId] = useState<string | null>(entryHasId ? entry.cloneFromId : null);
  // The option `sourceId` was picked under, so switching option cards on step 1 never asks
  // the other kind's detail endpoint for an id that belongs to a different table.
  const [sourceOption, setSourceOption] = useState<StartOption>(entryOption);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [prefilledKey, setPrefilledKey] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(entry.cloneFrom !== null && !entryHasId);
  const [entryFailed, setEntryFailed] = useState(entry.cloneFrom !== null && !entryHasId);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeSourceId = sourceOption === option && sourceId ? sourceId : '';

  const canonicalSetsQuery = useCanonicalSets();
  const publicSetsQuery = usePublicSets(PUBLIC_LIST_FILTERS);
  const canonicalDetailQuery = useCanonicalSet(option === 'canonical' ? activeSourceId : '');
  const publicDetailQuery = usePublicSet(option === 'public' ? activeSourceId : '');
  const createSet = useCreateSet();

  const canonicalSets = canonicalSetsQuery.data ?? [];
  const publicSets = publicSetsQuery.data?.items ?? [];

  const canonicalSummary =
    option === 'canonical' && activeSourceId
      ? canonicalSets.find((set) => set.id === activeSourceId)
      : undefined;
  const publicSummary =
    option === 'public' && activeSourceId
      ? publicSets.find((set) => set.id === activeSourceId)
      : undefined;
  const summary = canonicalSummary ?? publicSummary;

  const detailQuery =
    option === 'canonical'
      ? canonicalDetailQuery
      : option === 'public'
        ? publicDetailQuery
        : undefined;
  let detail: SourceDetail | undefined;
  if (option === 'canonical' && canonicalDetailQuery.data) {
    const data = canonicalDetailQuery.data;
    detail = { name: data.name, description: data.description, coins: data.coins };
  } else if (option === 'public' && publicDetailQuery.data) {
    const data = publicDetailQuery.data;
    detail = { name: data.name, description: null, coins: data.coins };
  }
  const detailLoading = Boolean(detailQuery?.isLoading);
  const detailError = Boolean(detailQuery?.isError);

  // Not found: the detail request for the picked source failed (404 for an unknown id,
  // 400 for a malformed one). Adjusted during render rather than in an effect, so step 2
  // never commits with a broken source.
  const sourceFailed = step === 2 && option !== 'blank' && activeSourceId !== '' && detailError;
  if (sourceFailed) {
    if (activeSourceId === entry.cloneFromId) setEntryFailed(true);
    setStep(1);
    setSourceId(null);
    setNotFound(true);
  }

  const sourceName = summary
    ? resolveLocalizedText(summary.name, locale)
    : detail
      ? resolveLocalizedText(detail.name, locale)
      : '';

  // Pre-fill the name once per source as soon as its name is known (covers the URL entry,
  // where the name arrives with the list or the detail), unless the user has typed.
  const sourceKey = `${option}:${activeSourceId}`;
  if (
    !sourceFailed &&
    step === 2 &&
    option !== 'blank' &&
    activeSourceId !== '' &&
    !nameTouched &&
    sourceName !== '' &&
    prefilledKey !== sourceKey
  ) {
    setPrefilledKey(sourceKey);
    setName(sourceName);
  }

  function selectOption(next: StartOption) {
    setOption(next);
  }

  function pickSource(id: string | null, pickedName: string) {
    setSourceId(id);
    setSourceOption(option);
    setStep(2);
    setNotFound(false);
    if (!nameTouched) {
      setName(pickedName);
      setPrefilledKey(`${option}:${id ?? ''}`);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (name === '') return;

    const body: CreateSetRequestBody =
      option === 'blank'
        ? { name }
        : {
            name,
            cloneFrom: { type: option === 'canonical' ? 'canonical' : 'user', id: activeSourceId },
          };

    createSet.mutate(body, {
      onSuccess: (set) => router.push(`/sets/${set.id}`),
      onError: (err: unknown) => {
        setError(err instanceof Error && err.message ? err.message : t('setNew.defaultError'));
      },
    });
  }

  const cancelHref =
    entry.cloneFrom === null || entryFailed
      ? '/dashboard'
      : entry.cloneFrom === 'canonical'
        ? `/sets/canonical/${encodeURIComponent(entry.cloneFromId)}`
        : `/sets/public/${encodeURIComponent(entry.cloneFromId)}`;

  const coinCount = detail ? detail.coins.length : summary?.coinCount;
  const submitLabel = createSet.isPending
    ? t('setNew.submitting')
    : option === 'blank' || typeof coinCount !== 'number'
      ? t('setNew.submit')
      : fillCount(t('setNew.submitWithCount'), coinCount);

  const searchTerm = search.trim().toLowerCase();
  const filteredPublicSets = searchTerm
    ? publicSets.filter((set) =>
        resolveLocalizedText(set.name, locale).toLowerCase().includes(searchTerm),
      )
    : publicSets;

  function renderSourcesState(isLoading: boolean, isError: boolean) {
    if (isLoading) {
      return (
        <div data-testid="set-new-sources-loading">
          <ListSkeleton />
        </div>
      );
    }
    if (isError) {
      return (
        <p data-testid="set-new-sources-error" className="text-sm text-danger">
          {t('common.somethingWentWrong')}
        </p>
      );
    }
    return null;
  }

  const sourceCardClass =
    'flex h-full w-full flex-col items-start gap-2 rounded-[var(--radius-lg)] border border-neutral-300 bg-white p-[18px] text-left transition hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-200';
  const sourceGridClass =
    'grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]';

  const coinSummary = detail ? summarizeSourceCoins(detail.coins) : null;
  const yearRange = coinSummary ? formatYearRange(coinSummary.minYear, coinSummary.maxYear) : '';
  const preview = detail ? buildCoinPreview(detail.coins) : null;
  const sourceDescription =
    option === 'canonical'
      ? summary && 'description' in summary
        ? summary.description
        : (detail?.description ?? null)
      : option === 'public'
        ? t('setNew.publicSourceDescription')
        : t('setNew.blankSourceDescription');

  return (
    <main
      data-testid="set-new-page"
      className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,40px)] py-7"
    >
      <div className="flex flex-col gap-2">
        <p data-testid="set-new-breadcrumb" className="text-[13px] text-neutral-700">
          <Link href="/dashboard" className="hover:text-accent-700 hover:underline">
            {t('setNew.breadcrumbMySets')}
          </Link>{' '}
          / {t('setNew.title')}
        </p>
        <h1 className={`${HEADING_FONT} text-[40px] font-semibold leading-[1.1]`}>
          {t('setNew.title')}
        </h1>
      </div>

      <ol
        data-testid="set-new-stepper"
        aria-label={t('setNew.stepsLabel')}
        className="flex items-center gap-3"
      >
        <li>
          <button
            type="button"
            data-testid="set-new-stepper-1"
            aria-current={step === 1 ? 'step' : undefined}
            onClick={() => setStep(1)}
            className="flex items-center gap-2 text-sm font-medium text-neutral-800 hover:text-accent-700"
          >
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                step === 1 ? 'bg-accent-700 font-mono text-white' : 'bg-accent text-white'
              }`}
            >
              {step === 1 ? '1' : '✓'}
            </span>
            {t('setNew.stepStart')}
          </button>
        </li>
        <li aria-hidden="true" className="h-px w-10 bg-neutral-400" />
        <li
          data-testid="set-new-stepper-2"
          aria-current={step === 2 ? 'step' : undefined}
          className="flex items-center gap-2 text-sm font-medium text-neutral-800"
        >
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm ${
              step === 2
                ? 'bg-accent-700 text-white'
                : 'border-[1.5px] border-neutral-500 text-neutral-700'
            }`}
          >
            2
          </span>
          {t('setNew.stepCreate')}
        </li>
      </ol>

      {step === 1 ? (
        <section data-testid="set-new-step-1" className="flex flex-col gap-5">
          {notFound && (
            <p
              data-testid="set-new-not-found"
              className="rounded-[var(--radius-md)] border border-neutral-300 bg-surface px-4 py-3 text-sm text-neutral-800"
            >
              {t('setNew.notFound')}
            </p>
          )}

          <h2 className={`${HEADING_FONT} text-[26px] font-semibold`}>
            {t('setNew.startHeading')}
          </h2>

          <div
            role="radiogroup"
            aria-label={t('setNew.stepStart')}
            className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]"
          >
            {OPTIONS.map((id) => {
              const selected = option === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`set-new-option-${id}`}
                  onClick={() => selectOption(id)}
                  className={`flex flex-col items-start gap-1.5 rounded-[var(--radius-lg)] text-left transition hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-200 ${
                    selected
                      ? 'border-2 border-accent bg-accent-100 p-[18px]'
                      : 'border border-neutral-300 bg-white p-[19px]'
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">{t(OPTION_TEXT_KEYS[id].title)}</span>
                    {id === 'canonical' && (
                      <span
                        data-testid="set-new-recommended"
                        className="rounded-full bg-accent-800 px-2 py-0.5 text-[11px] font-semibold text-accent-100"
                      >
                        {t('setNew.recommended')}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-neutral-800">
                    {t(OPTION_TEXT_KEYS[id].description)}
                  </span>
                </button>
              );
            })}
          </div>

          {option === 'canonical' && (
            <div className="flex flex-col gap-3">
              <h3 className={SUBHEADING_CLASS}>{t('setNew.chooseChecklist')}</h3>
              {renderSourcesState(canonicalSetsQuery.isLoading, canonicalSetsQuery.isError) ?? (
                <ul data-testid="set-new-canonical-list" className={sourceGridClass}>
                  {canonicalSets.map((set) => {
                    const resolvedName = resolveLocalizedText(set.name, locale);
                    return (
                      <li key={set.id}>
                        <button
                          type="button"
                          data-testid="set-new-canonical-card"
                          onClick={() => pickSource(set.id, resolvedName)}
                          className={sourceCardClass}
                        >
                          <span
                            className={`${HEADING_FONT} text-[22px] font-semibold leading-tight`}
                          >
                            {resolvedName}
                          </span>
                          {set.description !== null && (
                            <span className="line-clamp-2 text-[13px] text-neutral-800">
                              {set.description}
                            </span>
                          )}
                          {typeof set.coinCount === 'number' && (
                            <span className={CHIP_CLASS}>
                              {fillCount(t('setNew.coinsChip'), set.coinCount)}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {option === 'public' && (
            <div className="flex flex-col gap-3">
              <h3 className={SUBHEADING_CLASS}>{t('setNew.chooseCollectorSet')}</h3>
              <input
                type="search"
                data-testid="set-new-public-search"
                aria-label={t('setNew.searchPublicLabel')}
                placeholder={t('setNew.searchPublicPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`h-[42px] w-full max-w-[480px] ${INPUT_CLASS}`}
              />
              {renderSourcesState(publicSetsQuery.isLoading, publicSetsQuery.isError) ?? (
                <ul data-testid="set-new-public-list" className={sourceGridClass}>
                  {filteredPublicSets.map((set) => {
                    const resolvedName = resolveLocalizedText(set.name, locale);
                    return (
                      <li key={set.id}>
                        <button
                          type="button"
                          data-testid="set-new-public-card"
                          onClick={() => pickSource(set.id, resolvedName)}
                          className={sourceCardClass}
                        >
                          <span
                            className={`${HEADING_FONT} text-[22px] font-semibold leading-tight`}
                          >
                            {resolvedName}
                          </span>
                          {typeof set.coinCount === 'number' && (
                            <span className={CHIP_CLASS}>
                              {fillCount(t('setNew.coinsChip'), set.coinCount)}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {option === 'blank' && (
            <div
              data-testid="set-new-blank-panel"
              className="flex flex-col items-start gap-4 rounded-[var(--radius-lg)] bg-surface p-5"
            >
              <p className="text-sm text-neutral-800">{t('setNew.blankExplanation')}</p>
              <button
                type="button"
                data-testid="set-new-continue"
                onClick={() => pickSource(null, '')}
                className={`min-h-11 ${PRIMARY_BUTTON_CLASS}`}
              >
                {t('setNew.continue')}
              </button>
            </div>
          )}
        </section>
      ) : (
        <div
          data-testid="set-new-step-2"
          className="flex flex-col gap-8 min-[720px]:flex-row min-[720px]:flex-wrap min-[720px]:items-start"
        >
          <section className="flex min-w-0 flex-col gap-5 min-[720px]:[flex:999_1_560px]">
            <div
              data-testid="set-new-source-card"
              className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-neutral-300 bg-white p-[22px]"
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  data-testid="set-new-source-eyebrow"
                  className="text-xs font-semibold uppercase tracking-[0.06em] text-neutral-700"
                >
                  {option === 'canonical'
                    ? t('setNew.eyebrowCanonical')
                    : option === 'public'
                      ? t('setNew.eyebrowPublic')
                      : t('setNew.eyebrowBlank')}
                </span>
                <button
                  type="button"
                  data-testid="set-new-change"
                  onClick={() => setStep(1)}
                  className="text-sm text-accent-700 underline hover:text-accent-800"
                >
                  {t('setNew.change')}
                </button>
              </div>
              <h2
                data-testid="set-new-source-name"
                className={`${HEADING_FONT} text-[28px] font-semibold leading-tight`}
              >
                {option === 'blank' ? t('setNew.blankSourceName') : sourceName}
              </h2>
              {sourceDescription !== null && (
                <p data-testid="set-new-source-description" className="text-sm text-neutral-800">
                  {sourceDescription}
                </p>
              )}
              {option !== 'blank' && coinSummary && (
                <div data-testid="set-new-source-chips" className="flex flex-wrap gap-2 pt-1">
                  <span className={CHIP_CLASS}>
                    {fillCount(t('setNew.coinsChip'), coinSummary.count)}
                  </span>
                  {yearRange !== '' && <span className={CHIP_CLASS}>{yearRange}</span>}
                  {coinSummary.countries.length === 1 && (
                    <span className="rounded-[var(--radius-md)] bg-surface px-2 py-0.5 text-xs">
                      {coinSummary.countries[0]}
                    </span>
                  )}
                  {coinSummary.countries.length > 1 && (
                    <span className="rounded-[var(--radius-md)] bg-surface px-2 py-0.5 text-xs">
                      {fillCount(t('setNew.countriesChip'), coinSummary.countries.length)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {option !== 'blank' && (
              <div data-testid="set-new-preview" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className={SUBHEADING_CLASS}>{t('setNew.previewHeading')}</h3>
                  <p className="text-[13px] text-neutral-700">{t('setNew.previewNote')}</p>
                </div>
                {detailLoading && !detail ? (
                  <div data-testid="set-new-preview-loading">
                    <ListSkeleton />
                  </div>
                ) : (
                  preview && (
                    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-neutral-300 bg-neutral-100 p-4">
                      {preview.groups.map((group) => (
                        <div key={group.year} className="flex flex-col gap-2">
                          <div
                            data-testid="set-new-preview-year"
                            className={`${HEADING_FONT} text-lg font-semibold`}
                          >
                            {group.year}
                          </div>
                          <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))]">
                            {group.coins.map((coin) => (
                              <li
                                key={coin.id}
                                data-testid="set-new-preview-item"
                                className="flex min-w-0 items-center gap-3"
                              >
                                <span
                                  aria-hidden="true"
                                  className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-400 bg-neutral-300 font-mono text-xs text-neutral-800"
                                >
                                  {coin.imageUrl ? (
                                    <img
                                      src={coin.imageUrl}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    getDenominationNumeral(coin.denomination)
                                  )}
                                </span>
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate text-sm font-medium">
                                    {getAlbumCardText(coin).title}
                                  </span>
                                  <span className="text-xs text-neutral-700">
                                    {coin.denomination}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {preview.rest > 0 && (
                        <p data-testid="set-new-preview-more" className="text-sm text-neutral-700">
                          {fillCount(t('setNew.previewMore'), preview.rest)}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          <aside
            data-testid="set-new-aside"
            className="order-first flex flex-col gap-4 rounded-[var(--radius-lg)] border border-neutral-300 bg-white p-[22px] min-[720px]:order-none min-[720px]:max-w-[400px] min-[720px]:[flex:1_1_320px]"
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <h2 className={`${HEADING_FONT} text-2xl font-semibold`}>
                {t('setNew.nameHeading')}
              </h2>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="set-new-name" className="text-sm font-medium">
                  {t('setNew.nameLabel')}
                </label>
                <input
                  id="set-new-name"
                  data-testid="set-new-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setNameTouched(true);
                    setName(e.target.value);
                  }}
                  className={`h-11 w-full ${INPUT_CLASS}`}
                />
              </div>
              <p className="text-[13px] text-neutral-700">{t('setNew.publicHelper')}</p>

              {error && (
                <p data-testid="set-new-error" role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}

              <button
                type="submit"
                data-testid="set-new-submit"
                disabled={createSet.isPending}
                className={`min-h-12 w-full ${PRIMARY_BUTTON_CLASS}`}
              >
                {submitLabel}
              </button>
              <Link
                data-testid="set-new-cancel"
                href={cancelHref}
                className="self-center text-sm text-accent-700 underline hover:text-accent-800"
              >
                {t('setNew.cancel')}
              </Link>
            </form>

            <div className="flex flex-col gap-2 border-t border-divider pt-4">
              <h3 className={SUBHEADING_CLASS}>{t('setNew.nextHeading')}</h3>
              <ol
                data-testid="set-new-next-steps"
                className="list-decimal space-y-1 pl-5 text-[13px] text-neutral-800"
              >
                <li>{option === 'blank' ? t('setNew.nextOpensBlank') : t('setNew.nextOpens')}</li>
                <li>{t('setNew.nextTick')}</li>
                <li>{t('setNew.nextEdit')}</li>
              </ol>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

export default function NewSetPage() {
  return (
    <RequireAuth>
      <NewSetForm />
    </RequireAuth>
  );
}
