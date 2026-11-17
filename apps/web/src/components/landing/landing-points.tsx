'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';

const CHIP_CLASSES =
  'inline-flex h-7 items-center rounded-full border border-neutral-300 bg-neutral-100 px-3 text-xs font-medium text-neutral-800';

function Point({ title, body, visual }: { title: MessageKey; body: MessageKey; visual: ReactNode }) {
  const { t } = useTranslation();
  return (
    <article data-testid="landing-point" className="flex min-w-0 flex-col gap-3">
      <div
        aria-hidden="true"
        className="flex min-h-[132px] items-center justify-center rounded-[7px] border border-neutral-300 bg-white p-4 max-[899px]:hidden"
      >
        {visual}
      </div>
      <h3 className="text-[26px] leading-[1.15] text-text">{t(title)}</h3>
      <p className="text-[15px] leading-relaxed text-neutral-800">{t(body)}</p>
    </article>
  );
}

/** The three-points band ("How it works"). The visual cards are decorative and hidden under 900px. */
export function LandingPoints() {
  const { t } = useTranslation();

  return (
    <section
      data-testid="landing-points"
      aria-labelledby="landing-points-heading"
      className="w-full border-y border-[color:var(--color-divider)] bg-surface"
    >
      <h2 id="landing-points-heading" className="sr-only">
        {t('landing.pointsHeading')}
      </h2>
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-7 px-5 py-10 min-[900px]:grid-cols-3 min-[900px]:px-10 min-[900px]:py-14">
        <Point
          title="landing.p1Title"
          body="landing.p1Body"
          visual={
            <div className="flex flex-wrap justify-center gap-2">
              <span className={CHIP_CLASSES}>{t('landing.p1ChipFilter')}</span>
              <span className={CHIP_CLASSES}>{t('landing.p1ChipHand')}</span>
              <span className={CHIP_CLASSES}>{t('landing.p1ChipCurated')}</span>
            </div>
          }
        />
        <Point
          title="landing.p2Title"
          body="landing.p2Body"
          visual={
            <div className="flex w-full items-center gap-4">
              <PlaceholderCoin size={72} denomination="1 Cent" material="Bronze" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 text-[13px] text-neutral-800">
                {['Lincoln Wheat Cents', 'Lincoln Wheat Cent Key Dates'].map((setName) => (
                  <span key={setName} className="flex items-center justify-between gap-2">
                    <span className="truncate">{setName}</span>
                    <Badge variant="owned" />
                  </span>
                ))}
              </div>
            </div>
          }
        />
        <Point
          title="landing.p3Title"
          body="landing.p3Body"
          visual={
            <div className="w-full max-w-[220px] font-mono text-[13px]">
              <div className="flex gap-3 border-b border-dashed border-neutral-300 py-1">
                <span className="w-12 font-medium text-text">1909</span>
                <span className="text-neutral-800">S ★ · S VDB ★</span>
              </div>
              <div className="flex gap-3 border-b border-dashed border-neutral-300 py-1">
                <span className="w-12 font-medium text-text">1914</span>
                <span className="text-neutral-800">D ★ · S</span>
              </div>
              <div className="flex gap-3 py-1">
                <span className="w-12 font-medium text-text">1916</span>
                <span className="text-neutral-800">S</span>
              </div>
            </div>
          }
        />
      </div>
    </section>
  );
}
