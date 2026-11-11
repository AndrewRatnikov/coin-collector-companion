'use client';

import type { CanonicalSetSummary, PublicSetSummary } from '@coin-collector/shared';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { fill } from '@/lib/fill-template';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';
import type { StartOption } from '@/lib/new-set-entry';
import {
  CHIP_CLASS,
  HEADING_FONT,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SUBHEADING_CLASS,
} from '@/components/set-new/set-new-shared';

const OPTIONS: StartOption[] = ['canonical', 'public', 'blank'];

const OPTION_TEXT_KEYS = {
  canonical: {
    title: 'setNew.optionCanonicalTitle',
    description: 'setNew.optionCanonicalDescription',
  },
  public: { title: 'setNew.optionPublicTitle', description: 'setNew.optionPublicDescription' },
  blank: { title: 'setNew.optionBlankTitle', description: 'setNew.optionBlankDescription' },
} as const;

export interface SetNewStep1Props {
  notFound: boolean;
  option: StartOption;
  onSelectOption: (next: StartOption) => void;
  canonicalSetsLoading: boolean;
  canonicalSetsError: boolean;
  canonicalSets: CanonicalSetSummary[];
  publicSetsLoading: boolean;
  publicSetsError: boolean;
  filteredPublicSets: PublicSetSummary[];
  search: string;
  onSearchChange: (value: string) => void;
  onPickSource: (id: string | null, pickedName: string) => void;
}

/** Step 1: the start option cards, then the checklist list, public-set list or blank panel. */
export function SetNewStep1({
  notFound,
  option,
  onSelectOption,
  canonicalSetsLoading,
  canonicalSetsError,
  canonicalSets,
  publicSetsLoading,
  publicSetsError,
  filteredPublicSets,
  search,
  onSearchChange,
  onPickSource,
}: SetNewStep1Props) {
  const { t, locale } = useTranslation();

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

  return (
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
              onClick={() => onSelectOption(id)}
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
          {renderSourcesState(canonicalSetsLoading, canonicalSetsError) ?? (
            <ul data-testid="set-new-canonical-list" className={sourceGridClass}>
              {canonicalSets.map((set) => {
                const resolvedName = resolveLocalizedText(set.name, locale);
                return (
                  <li key={set.id}>
                    <button
                      type="button"
                      data-testid="set-new-canonical-card"
                      onClick={() => onPickSource(set.id, resolvedName)}
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
                          {fill(t('setNew.coinsChip'), { count: set.coinCount })}
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
            onChange={(e) => onSearchChange(e.target.value)}
            className={`h-[42px] w-full max-w-[480px] ${INPUT_CLASS}`}
          />
          {renderSourcesState(publicSetsLoading, publicSetsError) ?? (
            <ul data-testid="set-new-public-list" className={sourceGridClass}>
              {filteredPublicSets.map((set) => {
                const resolvedName = resolveLocalizedText(set.name, locale);
                return (
                  <li key={set.id}>
                    <button
                      type="button"
                      data-testid="set-new-public-card"
                      onClick={() => onPickSource(set.id, resolvedName)}
                      className={sourceCardClass}
                    >
                      <span
                        className={`${HEADING_FONT} text-[22px] font-semibold leading-tight`}
                      >
                        {resolvedName}
                      </span>
                      {typeof set.coinCount === 'number' && (
                        <span className={CHIP_CLASS}>
                          {fill(t('setNew.coinsChip'), { count: set.coinCount })}
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
            onClick={() => onPickSource(null, '')}
            className={`min-h-11 ${PRIMARY_BUTTON_CLASS}`}
          >
            {t('setNew.continue')}
          </button>
        </div>
      )}
    </section>
  );
}
