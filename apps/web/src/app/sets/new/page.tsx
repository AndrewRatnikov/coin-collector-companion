'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CreateSetRequestBody } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSets } from '@/lib/hooks/use-public-sets';
import { useCreateSet } from '@/lib/hooks/use-user-sets';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

type Mode = 'blank' | 'canonical' | 'public';

function NewSetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();

  const initialCloneFrom = searchParams.get('cloneFrom');
  const initialCloneFromId = searchParams.get('cloneFromId') ?? '';
  const initialMode: Mode =
    initialCloneFrom === 'canonical' ? 'canonical' : initialCloneFrom === 'user' ? 'public' : 'blank';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [canonicalId, setCanonicalId] = useState(initialMode === 'canonical' ? initialCloneFromId : '');
  const [publicId, setPublicId] = useState(initialMode === 'public' ? initialCloneFromId : '');
  const [error, setError] = useState<string | null>(null);

  const { data: canonicalSets } = useCanonicalSets();
  const { data: publicSetsPage } = usePublicSets({ page: 1, limit: 50 });
  const createSetMutation = useCreateSet();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const body: CreateSetRequestBody =
      mode === 'blank'
        ? { name }
        : mode === 'canonical'
          ? { name, cloneFrom: { type: 'canonical', id: canonicalId } }
          : { name, cloneFrom: { type: 'user', id: publicId } };

    createSetMutation.mutate(body, {
      onSuccess: (result) => {
        router.push(`/sets/${result.id}`);
      },
      onError: (err: unknown) => {
        setError(err instanceof Error ? err.message : t('setNew.defaultError'));
      },
    });
  }

  return (
    <main data-testid="set-new-page" className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-lg font-semibold">{t('setNew.title')}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="set-new-name" className="text-sm font-medium">
            {t('common.name')}
          </label>
          <input
            id="set-new-name"
            data-testid="set-new-name-input"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t('setNew.startFromLegend')}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="set-new-mode"
              data-testid="set-new-mode-blank"
              checked={mode === 'blank'}
              onChange={() => setMode('blank')}
            />
            {t('setNew.modeBlank')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="set-new-mode"
              data-testid="set-new-mode-canonical"
              checked={mode === 'canonical'}
              onChange={() => setMode('canonical')}
            />
            {t('setNew.modeCanonical')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="set-new-mode"
              data-testid="set-new-mode-public"
              checked={mode === 'public'}
              onChange={() => setMode('public')}
            />
            {t('setNew.modePublic')}
          </label>
        </fieldset>

        {mode === 'canonical' && (
          <select
            data-testid="set-new-canonical-select"
            value={canonicalId}
            onChange={(e) => setCanonicalId(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('setNew.selectCanonicalPlaceholder')}</option>
            {(canonicalSets ?? []).map((set) => (
              <option key={set.id} value={set.id}>
                {resolveLocalizedText(set.name, locale)}
              </option>
            ))}
          </select>
        )}

        {mode === 'public' && (
          <select
            data-testid="set-new-public-select"
            value={publicId}
            onChange={(e) => setPublicId(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('setNew.selectPublicPlaceholder')}</option>
            {(publicSetsPage?.items ?? []).map((set) => (
              <option key={set.id} value={set.id}>
                {resolveLocalizedText(set.name, locale)}
              </option>
            ))}
          </select>
        )}

        {error && (
          <p data-testid="set-new-error" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          data-testid="set-new-submit"
          className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          {t('setNew.submit')}
        </button>
      </form>
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
