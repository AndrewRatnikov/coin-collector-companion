'use client';

import { Fragment, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import type { GapViewResponse, UserSetSummary } from '@coin-collector/shared';
import { SetProgress } from '@/components/sets/set-progress';
import { UpgradeIcon } from '@/components/ui/upgrade-badge';
import { getSetKind, getSetSharedParts, type SetKind } from '@/lib/set-page';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

const KIND_LABEL: Record<SetKind, MessageKey> = {
  curated: 'setPage.kindCurated',
  copied: 'setPage.kindCopied',
  own: 'setPage.kindOwn',
};

/** "{n} to upgrade" with the number in mono; the text content stays the plain sentence. */
function UpgradeCountText({ template, n }: { template: string; n: number }) {
  const parts = template.split('{n}');
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="font-mono tabular-nums">{n}</span>}
          {part}
        </Fragment>
      ))}
    </>
  );
}

export interface SetPageHeaderProps {
  isOwner: boolean;
  /** For the kind label in the subtitle (getSetKind). */
  set: Pick<UserSetSummary, 'clonedFromCanonicalId' | 'clonedFromUserSetId'>;
  /** slots (subtitle shared parts), ownedCount, totalCount, completionPercent (SetProgress). */
  gaps: GapViewResponse;
  renaming: boolean;
  nameInputRef: RefObject<HTMLInputElement | null>;
  nameValue: string;
  savedName: string;
  onNameChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  showUpgrades: boolean;
  upgradeCount: number;
  /** The toolbar's grid cells (segs + actions); rendered last inside <header>. */
  children: ReactNode;
}

/**
 * The set page's header grid: crumb, name (or the rename input), subtitle and progress, then the
 * toolbar cells passed as children. One DOM for both layouts: grid areas move the actions next to
 * the crumb under 900px.
 */
export function SetPageHeader({
  isOwner,
  set,
  gaps,
  renaming,
  nameInputRef,
  nameValue,
  savedName,
  onNameChange,
  onCommitRename,
  onCancelRename,
  showUpgrades,
  upgradeCount,
  children,
}: SetPageHeaderProps) {
  const { t, locale } = useTranslation();

  const shared = getSetSharedParts(gaps.slots);
  const subtitleParts: ReactNode[] = [t(KIND_LABEL[getSetKind(set)])];
  if (shared.country !== null) subtitleParts.push(shared.country);
  if (shared.denomination !== null) subtitleParts.push(shared.denomination);
  if (shared.years !== null) {
    subtitleParts.push(
      <span data-testid="set-editor-subtitle-years" className="font-mono tabular-nums">
        {shared.years}
      </span>,
    );
  }

  return (
    <header
      className={[
        'grid items-end gap-x-6 gap-y-3 border-b border-divider pb-[18px]',
        'grid-cols-[minmax(0,1fr)_minmax(0,300px)]',
        "[grid-template-areas:'crumb_crumb'_'title_progress'_'segs_actions']",
        'max-[899px]:grid-cols-[minmax(0,1fr)_auto] max-[899px]:items-center',
        "max-[899px]:[grid-template-areas:'crumb_actions'_'title_title'_'progress_progress'_'segs_segs']",
      ].join(' ')}
    >
      <p className="[grid-area:crumb] text-[13px] text-neutral-700">
        <Link
          href={isOwner ? '/dashboard' : '/sets/public'}
          data-testid="set-editor-breadcrumb"
          className="inline-flex min-h-9 items-center hover:text-accent-700 hover:underline"
        >
          {isOwner ? t('setPage.breadcrumbMySets') : t('setPage.breadcrumbPublicSets')}
        </Link>
      </p>

      <div className="[grid-area:title] flex min-w-0 flex-col gap-1.5 self-end">
        <h1
          data-testid="set-editor-name"
          className="m-0 font-[family-name:var(--font-heading)] text-[40px] font-semibold leading-[1.1] [overflow-wrap:anywhere] max-[719px]:text-[30px]"
        >
          {renaming ? (
            <input
              ref={nameInputRef}
              data-testid="set-editor-name-input"
              type="text"
              aria-label={t('setEditor.renameSet')}
              value={nameValue}
              onChange={(e) => onNameChange(e.target.value)}
              onBlur={onCommitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCommitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelRename();
                }
              }}
              className="w-full border-b border-accent-700 bg-transparent [font:inherit] focus:outline-none"
            />
          ) : (
            resolveLocalizedText(savedName, locale)
          )}
        </h1>
        <p data-testid="set-editor-subtitle" className="text-sm text-neutral-700">
          {subtitleParts.map((part, index) => (
            <Fragment key={index}>
              {index > 0 && ' · '}
              {part}
            </Fragment>
          ))}
        </p>
      </div>

      <SetProgress
        testIdPrefix="set-editor"
        className="[grid-area:progress] self-end"
        ownedTemplate={t('setEditor.ownedOfTotal')}
        owned={gaps.ownedCount}
        total={gaps.totalCount}
        percent={gaps.completionPercent}
        upgradeSlot={
          showUpgrades ? (
            <span
              data-testid="set-editor-upgrade-count"
              className="inline-flex items-baseline gap-1 text-sm text-accent-800"
            >
              <UpgradeIcon className="self-center" />
              <UpgradeCountText template={t('setPage.upgradeCount')} n={upgradeCount} />
            </span>
          ) : undefined
        }
      />

      {children}
    </header>
  );
}
