'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CreateSetRequestBody } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { HEADING_FONT, type SourceDetail } from '@/components/set-new/set-new-shared';
import { SetNewStep1 } from '@/components/set-new/set-new-step-1';
import { SetNewStep2 } from '@/components/set-new/set-new-step-2';
import { SetNewStepper } from '@/components/set-new/set-new-stepper';
import { useCanonicalSet, useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSet, usePublicSets } from '@/lib/hooks/use-public-sets';
import { useCreateSet } from '@/lib/hooks/use-user-sets';
import { buildCoinPreview, formatYearRange, summarizeSourceCoins } from '@/lib/new-set-preview';
import { readEntry, type EntryParams, type Step, type StartOption } from '@/lib/new-set-entry';
import { fill } from '@/lib/fill-template';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

const PUBLIC_LIST_FILTERS = { page: 1, limit: 100 };

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
      : fill(t('setNew.submitWithCount'), { count: coinCount });

  const searchTerm = search.trim().toLowerCase();
  const filteredPublicSets = searchTerm
    ? publicSets.filter((set) =>
        resolveLocalizedText(set.name, locale).toLowerCase().includes(searchTerm),
      )
    : publicSets;

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

      <SetNewStepper step={step} onStepOneClick={() => setStep(1)} />

      {step === 1 ? (
        <SetNewStep1
          notFound={notFound}
          option={option}
          onSelectOption={selectOption}
          canonicalSetsLoading={canonicalSetsQuery.isLoading}
          canonicalSetsError={canonicalSetsQuery.isError}
          canonicalSets={canonicalSets}
          publicSetsLoading={publicSetsQuery.isLoading}
          publicSetsError={publicSetsQuery.isError}
          filteredPublicSets={filteredPublicSets}
          search={search}
          onSearchChange={setSearch}
          onPickSource={pickSource}
        />
      ) : (
        <SetNewStep2
          option={option}
          onChangeSource={() => setStep(1)}
          sourceName={sourceName}
          sourceDescription={sourceDescription}
          coinSummary={coinSummary}
          yearRange={yearRange}
          detail={detail}
          detailLoading={detailLoading}
          preview={preview}
          onSubmit={handleSubmit}
          name={name}
          onNameChange={(value) => {
            setNameTouched(true);
            setName(value);
          }}
          error={error}
          isPending={createSet.isPending}
          submitLabel={submitLabel}
          cancelHref={cancelHref}
        />
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
