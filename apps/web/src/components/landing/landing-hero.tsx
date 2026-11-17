'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GapDemo } from '@/components/landing/gap-demo';
import { WantList } from '@/components/landing/want-list';
import { useTranslation } from '@/lib/i18n/i18n-context';
import {
  LINCOLN_SAMPLE_KEY_DATE_IDS,
  LINCOLN_SAMPLE_MOBILE_SLOTS,
  LINCOLN_SAMPLE_SLOTS,
} from '@/lib/landing/lincoln-sample';

export interface LandingHeroProps {
  /** Default false (variant A, read-only demo). true switches the demo to variant B. */
  interactive?: boolean;
  /** Under 900px: the 1909-1912 slice for the demo and the want list. */
  compact?: boolean;
  setCoinCount: number;
  fullChecklistHref: string;
}

/**
 * The hero row: pitch, calls to action and the want list on the left, the sample demo on the
 * right (stacked copy, demo, want list on mobile). Owns the variant-B sample ownership, which
 * lives only in local state: nothing is saved and nothing goes to the API.
 */
export function LandingHero({ interactive = false, compact = false, setCoinCount, fullChecklistHref }: LandingHeroProps) {
  const { t } = useTranslation();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const slots = useMemo(() => {
    const base = compact ? LINCOLN_SAMPLE_MOBILE_SLOTS : LINCOLN_SAMPLE_SLOTS;
    return base.map((slot) => (slot.id in overrides ? { ...slot, owned: overrides[slot.id] } : slot));
  }, [compact, overrides]);

  function handleToggle(coinId: string) {
    const current = slots.find((slot) => slot.coin.id === coinId);
    if (!current) return;
    setOverrides((prev) => ({ ...prev, [current.id]: !current.owned }));
  }

  return (
    <div
      data-testid="landing-hero"
      className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-y-7 px-5 pt-8 pb-12 min-[900px]:grid-cols-[minmax(0,380px)_minmax(0,1fr)] min-[900px]:gap-x-12 min-[900px]:px-10 min-[900px]:pt-10 min-[900px]:pb-14"
    >
      <div className="flex min-w-0 flex-col min-[900px]:col-start-1 min-[900px]:row-start-1">
        <p className="text-[11px] font-medium uppercase tracking-[.16em] text-neutral-700">{t('landing.eyebrow')}</p>
        <h1
          data-testid="landing-headline"
          className="mt-3 text-[38px] leading-[1.04] font-semibold text-text min-[900px]:text-[56px]"
        >
          {t('landing.headline')}
        </h1>
        <p data-testid="landing-body" className="mt-4 text-[18px] leading-relaxed text-neutral-800 max-[599px]:hidden">
          {t('landing.body')}
        </p>
        <p
          data-testid="landing-body-short"
          className="mt-4 text-[17px] leading-relaxed text-neutral-800 min-[600px]:hidden"
        >
          {t('landing.bodyShort')}
        </p>
        <div className="mt-6 flex flex-col gap-3 min-[600px]:flex-row min-[600px]:flex-wrap">
          <Link
            href="/signup"
            data-testid="landing-cta-primary"
            className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-accent-700 px-5 text-[15px] font-medium text-white hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
          >
            {t('landing.ctaPrimary')}
          </Link>
          <Link
            href="/sets/canonical"
            data-testid="landing-cta-secondary"
            className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-neutral-400 bg-white px-5 text-[15px] font-medium text-text hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
          >
            {t('landing.ctaSecondary')}
          </Link>
        </div>
        <p data-testid="landing-honest" className="mt-4 text-[13px] text-neutral-700">
          {t('landing.honest')}
        </p>
      </div>

      <div className="min-w-0 min-[900px]:col-start-2 min-[900px]:row-span-2 min-[900px]:row-start-1">
        <GapDemo
          slots={slots}
          interactive={interactive}
          onToggle={handleToggle}
          compact={compact}
          setCoinCount={setCoinCount}
          fullChecklistHref={fullChecklistHref}
        />
      </div>

      <div className="min-w-0 min-[900px]:col-start-1 min-[900px]:row-start-2">
        <WantList slots={slots} keyDateIds={LINCOLN_SAMPLE_KEY_DATE_IDS} />
      </div>
    </div>
  );
}
