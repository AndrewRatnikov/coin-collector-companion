'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStoredToken } from '@/lib/auth-token';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';
const PRIMARY_LINK = `inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-accent-700 px-[18px] text-[15px] font-medium text-white hover:bg-accent-800 ${FOCUS_RING}`;
const SECONDARY_LINK = `inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] border border-neutral-400 bg-white px-[18px] text-[15px] font-medium text-text hover:border-accent ${FOCUS_RING}`;

export type NotFoundVariant = 'page' | 'coin' | 'set' | 'checklist';

export interface NotFoundContentProps {
  variant: NotFoundVariant;
}

const COPY: Record<NotFoundVariant, { title: MessageKey; body: MessageKey }> = {
  page: { title: 'notFound.pageTitle', body: 'notFound.pageBody' },
  coin: { title: 'notFound.coinTitle', body: 'notFound.coinBody' },
  set: { title: 'notFound.setTitle', body: 'notFound.setBody' },
  checklist: { title: 'notFound.checklistTitle', body: 'notFound.checklistBody' },
};

/** Shared "not found" state: unknown URLs and detail pages whose record doesn't exist. */
export function NotFoundContent({ variant }: NotFoundContentProps) {
  const { t } = useTranslation();
  // Read after mount, like the detail pages, so server and first client render match.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getStoredToken()));
  }, []);

  const copy = COPY[variant];

  return (
    <section
      data-testid="not-found"
      data-variant={variant}
      aria-labelledby="not-found-title"
      className="flex flex-col gap-[22px] rounded-[var(--radius-lg)] border border-neutral-300 bg-white p-[clamp(20px,4vw,36px)]"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <h1
          id="not-found-title"
          data-testid="not-found-title"
          className="font-heading text-[32px] leading-[1.1] font-semibold text-text"
        >
          {t(copy.title)}
        </h1>
        <p data-testid="not-found-body" className="max-w-[560px] text-[15px] text-neutral-800">
          {t(copy.body)}
        </p>
      </div>
      <div data-testid="not-found-links" className="flex flex-wrap items-center gap-3">
        <Link data-testid="not-found-catalog-link" href="/catalog" className={PRIMARY_LINK}>
          {t('notFound.catalogLink')}
        </Link>
        <Link data-testid="not-found-checklists-link" href="/sets" className={SECONDARY_LINK}>
          {t('notFound.checklistsLink')}
        </Link>
        {isLoggedIn && (
          <Link data-testid="not-found-my-sets-link" href="/dashboard" className={SECONDARY_LINK}>
            {t('notFound.mySetsLink')}
          </Link>
        )}
      </div>
    </section>
  );
}
