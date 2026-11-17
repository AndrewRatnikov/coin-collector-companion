'use client';

import Link from 'next/link';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { fill } from '@/lib/fill-template';
import type { CoverageCounts } from '@/lib/landing/landing-data';

export interface CoverageProps {
  counts: CoverageCounts;
}

// PlaceholderCoin has no 56px step; the 72px disc (numeral and unit) scaled down to 56px.
const COIN_56 = 'size-[56px]! text-[56px]!';

/** "What's covered": the two catalog areas with their real (or fallback) counts. Never a skeleton. */
export function Coverage({ counts }: CoverageProps) {
  const { t } = useTranslation();

  return (
    <section
      data-testid="landing-coverage"
      aria-labelledby="landing-coverage-heading"
      className="mx-auto w-full max-w-[1320px] px-5 pb-14 min-[900px]:px-10 min-[900px]:pb-20"
    >
      <div className="grid grid-cols-1 gap-6 max-[899px]:rounded-[7px] max-[899px]:bg-surface max-[899px]:p-5 min-[900px]:grid-cols-[380px_minmax(0,1fr)] min-[900px]:gap-12">
        <div className="flex flex-col gap-3">
          <h2 id="landing-coverage-heading" className="text-[32px] leading-[1.1] text-text">
            {t('landing.coverageHeading')}
          </h2>
          <p className="text-[15px] leading-relaxed text-neutral-800">{t('landing.coverageIntro')}</p>
          <Link
            href="/catalog"
            data-testid="landing-coverage-submit"
            className="self-start text-[15px] font-medium text-accent-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
          >
            {t('landing.coverageSubmit')}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[600px]:grid-cols-2">
          <article className="flex gap-4 rounded-[7px] border border-neutral-300 bg-white p-5">
            <PlaceholderCoin size={72} denomination="1 Cent" material="Bronze" className={COIN_56} />
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="flex flex-wrap items-baseline gap-x-2 text-[22px] leading-tight text-text">
                {t('landing.coverageLincolnTitle')}
                <span className="font-mono text-[13px] font-normal text-neutral-700">1909–1958</span>
              </h3>
              <p className="text-sm text-neutral-800">{t('landing.coverageLincolnBody')}</p>
              <p data-testid="landing-coverage-lincoln-meta" className="font-mono text-xs text-neutral-700">
                {fill(t('landing.coverageLincolnMeta'), { coins: counts.coins, keyDates: counts.keyDates })}
              </p>
            </div>
          </article>
          <article className="flex gap-4 rounded-[7px] border border-neutral-300 bg-white p-5">
            <PlaceholderCoin size={72} denomination="10 Hryvnias" material="Brass" className={COIN_56} />
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="flex flex-wrap items-baseline gap-x-2 text-[22px] leading-tight text-text">
                {t('landing.coverageUkraineTitle')}
                <span className="font-mono text-[13px] font-normal text-neutral-700">1992–</span>
              </h3>
              <p className="text-sm text-neutral-800">{t('landing.coverageUkraineBody')}</p>
              <p data-testid="landing-coverage-ukraine-meta" className="font-mono text-xs text-neutral-700">
                {fill(t('landing.coverageUkraineMeta'), {
                  circulation: counts.circulation,
                  commemoratives: counts.commemoratives,
                })}
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
