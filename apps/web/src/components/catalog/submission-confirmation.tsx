'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import type { CatalogCoin, UserSetSummary } from '@coin-collector/shared';
import { useCreateSet, usePatchSetCoins, useUserSets } from '@/lib/hooks/use-user-sets';
import { patchSetCoins } from '@/lib/user-sets-api';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

export interface SubmissionConfirmationProps {
  coin: CatalogCoin;
}

interface AddToSetRowProps {
  set: UserSetSummary;
  coinId: string;
  onAdded: (setId: string) => void;
}

// Its own component (not a callback inside a .map in the parent) so usePatchSetCoins(set.id)
// — a fixed, already-known id — is called once per row, following the Rules of Hooks.
function AddToSetRow({ set, coinId, onAdded }: AddToSetRowProps) {
  const { t, locale } = useTranslation();
  const patchMutation = usePatchSetCoins(set.id);

  function handleAdd() {
    patchMutation.mutate({ add: [coinId] }, { onSuccess: () => onAdded(set.id) });
  }

  return (
    <li data-testid="submission-confirmation-set-item" className="flex items-center justify-between gap-4 rounded border border-gray-200 p-3">
      <span>{resolveLocalizedText(set.name, locale)}</span>
      <button
        type="button"
        data-testid="submission-confirmation-add-to-set-button"
        onClick={handleAdd}
        className="rounded border border-gray-300 px-3 py-1 text-xs"
      >
        {t('submissionConfirmation.addToSetButton')}
      </button>
    </li>
  );
}

export default function SubmissionConfirmation({ coin }: SubmissionConfirmationProps) {
  const { t } = useTranslation();
  const { data: userSets, isLoading } = useUserSets();
  const createSetMutation = useCreateSet();
  const [newSetName, setNewSetName] = useState('');
  const [linkedSetId, setLinkedSetId] = useState<string | null>(null);

  if (isLoading) {
    return <div data-testid="submission-confirmation-loading" />;
  }

  // Deliberately calls the plain patchSetCoins function, not the usePatchSetCoins hook —
  // the new set's id isn't known until createSetMutation succeeds, and binding a second
  // hook instance to a placeholder id and re-firing it after a state update is a real
  // render-timing footgun (see plan.md's Approach/Risks). The "existing sets" path above
  // doesn't have this problem since each set's id is already known at render time.
  function handleCreateAndAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createSetMutation.mutate(
      { name: newSetName },
      {
        onSuccess: (newSet) => {
          patchSetCoins(newSet.id, { add: [coin.id] }).then(() => setLinkedSetId(newSet.id));
        },
      },
    );
  }

  const hasExistingSets = Boolean(userSets && userSets.length > 0);

  return (
    <div data-testid="submission-confirmation" className="flex flex-col gap-4 rounded border border-gray-200 p-4">
      {hasExistingSets ? (
        <ul data-testid="submission-confirmation-existing-sets" className="flex flex-col gap-2">
          {(userSets ?? []).map((set) => (
            <AddToSetRow key={set.id} set={set} coinId={coin.id} onAdded={setLinkedSetId} />
          ))}
        </ul>
      ) : (
        <form
          data-testid="submission-confirmation-create-set-form"
          onSubmit={handleCreateAndAdd}
          className="flex items-end gap-2"
        >
          <input
            data-testid="submission-confirmation-create-set-name-input"
            type="text"
            required
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            data-testid="submission-confirmation-create-set-submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            {t('submissionConfirmation.createSetSubmit')}
          </button>
        </form>
      )}

      {linkedSetId && (
        <Link href={`/sets/${linkedSetId}`} data-testid="submission-confirmation-view-set-link" className="underline">
          {t('submissionConfirmation.viewSetLink')}
        </Link>
      )}
    </div>
  );
}
