'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import { getCoinName, getDenominationNumeral } from '@coin-collector/shared';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { fill } from '@/lib/fill-template';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { StartOption } from '@/lib/new-set-entry';
import type { CoinPreview, SourceCoinSummary } from '@/lib/new-set-preview';
import {
  CHIP_CLASS,
  HEADING_FONT,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SUBHEADING_CLASS,
  type SourceDetail,
} from '@/components/set-new/set-new-shared';

export interface SetNewStep2Props {
  option: StartOption;
  onChangeSource: () => void;
  sourceName: string;
  sourceDescription: string | null;
  coinSummary: SourceCoinSummary | null;
  yearRange: string;
  detail: SourceDetail | undefined;
  detailLoading: boolean;
  preview: CoinPreview | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  name: string;
  onNameChange: (value: string) => void;
  error: string | null;
  isPending: boolean;
  submitLabel: string;
  cancelHref: string;
}

/** Step 2: the source card and coin preview, plus the aside with the name form and next steps. */
export function SetNewStep2({
  option,
  onChangeSource,
  sourceName,
  sourceDescription,
  coinSummary,
  yearRange,
  detail,
  detailLoading,
  preview,
  onSubmit,
  name,
  onNameChange,
  error,
  isPending,
  submitLabel,
  cancelHref,
}: SetNewStep2Props) {
  const { t } = useTranslation();
  return (
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
              onClick={() => onChangeSource()}
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
                {fill(t('setNew.coinsChip'), { count: coinSummary.count })}
              </span>
              {yearRange !== '' && <span className={CHIP_CLASS}>{yearRange}</span>}
              {coinSummary.countries.length === 1 && (
                <span className="rounded-[var(--radius-md)] bg-surface px-2 py-0.5 text-xs">
                  {coinSummary.countries[0]}
                </span>
              )}
              {coinSummary.countries.length > 1 && (
                <span className="rounded-[var(--radius-md)] bg-surface px-2 py-0.5 text-xs">
                  {fill(t('setNew.countriesChip'), { count: coinSummary.countries.length })}
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
                        {group.coins.map((coin) => {
                          const coinName = getCoinName(coin);
                          return (
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
                                <span data-testid="set-new-preview-title" className="truncate text-sm font-medium">
                                  {coinName.title}
                                </span>
                                <span data-testid="set-new-preview-subtitle" className="text-xs text-neutral-700">
                                  {coinName.subtitle}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                  {preview.rest > 0 && (
                    <p data-testid="set-new-preview-more" className="text-sm text-neutral-700">
                      {fill(t('setNew.previewMore'), { count: preview.rest })}
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
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
              onChange={(e) => onNameChange(e.target.value)}
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
            disabled={isPending}
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
  );
}
