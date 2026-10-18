'use client';

import Link from 'next/link';
import type { SuggestedCanonicalSet } from '@coin-collector/shared';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface NextSetSuggestionProps {
  suggestion: SuggestedCanonicalSet;
}

const MONO_NUMBER = 'font-mono lining-nums tabular-nums';

/** The body sentence with its {total} and {owned} numbers in mono; text content stays the plain sentence. */
function SuggestionBody({
  template,
  total,
  owned,
}: {
  template: string;
  total: number;
  owned: number;
}) {
  const parts = template.split(/(\{total\}|\{owned\})/);
  return (
    <>
      {parts.map((part, index) => {
        if (part === '{total}' || part === '{owned}') {
          return (
            <span key={index} className={MONO_NUMBER}>
              {part === '{total}' ? total : owned}
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

/** "A good next set": the curated checklist that shares the most coins with the collection. */
export function NextSetSuggestion({ suggestion }: NextSetSuggestionProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="dashboard-suggestion"
      className="flex flex-col gap-[10px] rounded-[var(--radius-lg)] border border-dashed border-accent p-[18px]"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-neutral-800">
        {t('dashboard.suggestionEyebrow')}
      </span>
      <p
        data-testid="dashboard-suggestion-name"
        className="font-heading text-[22px] leading-[1.2] font-semibold text-text [overflow-wrap:anywhere]"
      >
        {suggestion.name}
      </p>
      <p data-testid="dashboard-suggestion-body" className="text-sm text-neutral-800">
        <SuggestionBody
          template={t('dashboard.suggestionBody')}
          total={suggestion.coinCount}
          owned={suggestion.ownedCount}
        />
      </p>
      <Link
        data-testid="dashboard-suggestion-cta"
        href={`/sets/new?cloneFrom=canonical&cloneFromId=${encodeURIComponent(suggestion.id)}`}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-[var(--radius-md)] border border-neutral-400 bg-white px-[18px] text-sm font-medium text-text hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
      >
        {t('dashboard.suggestionCta')}
      </Link>
    </div>
  );
}
