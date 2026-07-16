'use client';

import { useState } from 'react';
import type { SlotSuggestion } from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import { useLinkCoin } from '@/lib/hooks/use-coins';

interface SuggestionPanelProps {
  coinId: string;
  suggestions: SlotSuggestion[];
  onDone: () => void;
}

function linkLabel(suggestion: SlotSuggestion): string {
  const target = `${suggestion.setName} — ${suggestion.slotLabel}`;
  return suggestion.currentlyLinkedCoinId ? `Replace current link (${target})` : `Link to ${target}`;
}

// PRD §4.3: the suggestion panel is the routine path after saving a coin, not a fallback.
// 1 suggestion = one-tap confirm; >1 = a picker, since which slot is correct is genuinely
// ambiguous (e.g. a 1909-S cent matching both the plain and VDB slots).
export function SuggestionPanel({ coinId, suggestions, onDone }: SuggestionPanelProps) {
  const linkMutation = useLinkCoin();
  const [error, setError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState(
    suggestions.length === 1 ? suggestions[0].slotId : '',
  );

  function confirm(slotId: string) {
    setError(null);
    linkMutation.mutate(
      { id: coinId, slotId },
      {
        onSuccess: onDone,
        onError: (err) => {
          setError(
            err instanceof ApiError ? err.message : 'Could not link this coin. Please try again.',
          );
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-blue-200 bg-blue-50 p-4">
      <p className="text-sm font-medium text-blue-900">
        {suggestions.length === 1
          ? 'This coin matches an open slot:'
          : `This coin matches ${suggestions.length} open slots:`}
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {suggestions.length === 1 ? (
        <button
          type="button"
          onClick={() => confirm(suggestions[0].slotId)}
          disabled={linkMutation.isPending}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {linkMutation.isPending ? 'Linking…' : linkLabel(suggestions[0])}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions.map((suggestion) => (
            <label
              key={suggestion.slotId}
              className="flex items-center gap-2 rounded border border-blue-100 bg-white px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="slot-suggestion"
                value={suggestion.slotId}
                checked={selectedSlotId === suggestion.slotId}
                onChange={() => setSelectedSlotId(suggestion.slotId)}
              />
              <span>
                {suggestion.setName} — {suggestion.slotLabel}
                {suggestion.isKeyDate && <span className="ml-1 text-amber-600">★ key date</span>}
                {suggestion.currentlyLinkedCoinId && (
                  <span className="ml-1 text-gray-500">(will replace current coin)</span>
                )}
              </span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => confirm(selectedSlotId)}
            disabled={linkMutation.isPending || !selectedSlotId}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {linkMutation.isPending ? 'Linking…' : 'Confirm link'}
          </button>
        </div>
      )}

      <button type="button" onClick={onDone} className="self-start text-sm text-gray-600 underline">
        Not now
      </button>
    </div>
  );
}
