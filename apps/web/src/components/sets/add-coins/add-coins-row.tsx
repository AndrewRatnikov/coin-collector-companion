'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { getCoinName, type CatalogCoin } from '@coin-collector/shared';
import { type AddCoinsEntry, type AddCoinsRowAction } from '@/lib/add-coins';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { fill } from '@/lib/fill-template';
import { Badge } from '@/components/ui/badge';
import { CheckIcon, PlusIcon } from '@/components/ui/icons';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import { FOCUS_RING } from '@/components/sets/add-coins/add-coins-shared';

export interface AddCoinsRowProps {
  coin: CatalogCoin;
  action: AddCoinsRowAction;
  owned: boolean;
  error: AddCoinsEntry['error'];
  onAdd: () => void;
  onUndo: () => void;
}

export function AddCoinsRow({
  coin,
  action,
  owned,
  error,
  onAdd,
  onUndo,
}: AddCoinsRowProps) {
  const { t } = useTranslation();
  const name = getCoinName(coin);
  const addLabel =
    name.subtitle !== ''
      ? fill(t('addCoins.addLabel'), { title: name.title, sub: name.subtitle })
      : fill(t('addCoins.addLabelNoSub'), { title: name.title });

  let actionCell: ReactNode;
  switch (action) {
    case 'add':
      actionCell = (
        <button
          type="button"
          data-testid="add-coins-row-add"
          aria-label={addLabel}
          onClick={onAdd}
          className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border border-neutral-400 bg-white px-3 text-[13px] font-medium text-text hover:border-accent max-[899px]:size-11 max-[899px]:px-0 ${FOCUS_RING}`}
        >
          <PlusIcon />
          <span className="max-[899px]:sr-only">{t('addCoins.add')}</span>
        </button>
      );
      break;
    case 'adding':
      actionCell = (
        <span
          data-testid="add-coins-row-adding"
          aria-live="polite"
          className="inline-flex min-h-9 items-center gap-2 text-[13px] italic text-neutral-700"
        >
          <span
            aria-hidden="true"
            className="hidden size-5 rounded-full border-2 border-neutral-300 border-t-accent-700 motion-safe:animate-spin max-[899px]:inline-block"
          />
          <span className="max-[899px]:sr-only">{t('addCoins.adding')}</span>
        </span>
      );
      break;
    case 'added':
    case 'undoing':
      actionCell = (
        <span className="inline-flex items-center gap-2">
          <span
            data-testid="add-coins-row-added"
            aria-live="polite"
            className="inline-flex h-9 items-center rounded-full border border-accent-400 bg-accent-100 px-3 text-[13px] font-medium text-accent-800 max-[899px]:sr-only"
          >
            {t('addCoins.added')}
          </span>
          <button
            type="button"
            data-testid="add-coins-row-undo"
            aria-label={fill(t('addCoins.undoLabel'), { title: name.title })}
            disabled={action === 'undoing'}
            aria-busy={action === 'undoing' ? true : undefined}
            onClick={onUndo}
            className={`inline-flex min-h-9 cursor-pointer items-center justify-center rounded-[var(--radius-md)] px-1 text-[13px] font-medium text-accent-700 underline hover:text-accent-800 disabled:cursor-not-allowed disabled:opacity-50 max-[899px]:size-11 max-[899px]:rounded-full max-[899px]:bg-accent-700 max-[899px]:px-0 max-[899px]:text-white max-[899px]:no-underline ${FOCUS_RING}`}
          >
            <span className="hidden max-[899px]:inline-flex">
              <CheckIcon />
            </span>
            <span className="max-[899px]:sr-only">{t('addCoins.undo')}</span>
          </button>
        </span>
      );
      break;
    case 'already':
      actionCell = (
        <span data-testid="add-coins-row-already" className="text-[13px] text-neutral-700 max-[899px]:sr-only">
          {t('addCoins.already')}
        </span>
      );
      break;
  }

  return (
    <li
      data-testid="add-coins-row"
      data-coin-id={coin.id}
      data-action={action}
      className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-[rgba(32,31,29,0.1)] px-3 py-2.5 last:border-b-0"
    >
      <PlaceholderCoin size={40} denomination={coin.denomination} material={coin.material} imageUrl={coin.imageUrl} />
      <div className="flex min-w-0 flex-col gap-px leading-[1.3]">
        {name.eyebrow !== '' && (
          <span data-testid="add-coins-row-eyebrow" className="truncate text-[11px] font-medium text-neutral-700">
            {name.eyebrow}
          </span>
        )}
        <Link
          href={`/catalog/${coin.id}`}
          data-testid="add-coins-row-title"
          className={`self-start text-[15px] font-semibold text-text [overflow-wrap:anywhere] hover:underline ${FOCUS_RING}`}
        >
          {name.title}
        </Link>
        <span data-testid="add-coins-row-subtitle" className="text-xs text-neutral-700">
          {name.subtitle}
        </span>
        {(action === 'already' || owned) && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {action === 'already' && <Badge variant="in-set" />}
            {owned && <Badge variant="owned" />}
          </span>
        )}
        {error !== null && (
          <span data-testid="add-coins-row-error" className="mt-1 text-xs font-medium text-danger">
            {error === 'add' ? t('addCoins.addFailed') : t('addCoins.undoFailed')}
          </span>
        )}
      </div>
      <div className="flex items-center justify-end">{actionCell}</div>
    </li>
  );
}
