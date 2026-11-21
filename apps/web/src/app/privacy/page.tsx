'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';

const HEADING_CLASSES = 'text-[19px] font-normal [font-family:var(--font-heading)]';
const BODY_CLASSES = 'max-w-[60ch] text-[15px] leading-relaxed text-[var(--color-neutral-700)]';

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <main
      data-testid="privacy-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-8 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
    >
      <h1 className="text-[28px] font-normal leading-tight [font-family:var(--font-heading)]">{t('privacy.title')}</h1>

      <p data-testid="privacy-intro" className={BODY_CLASSES}>
        {t('privacy.intro')}
      </p>

      <section data-testid="privacy-stored" className="flex flex-col gap-3">
        <h2 className={HEADING_CLASSES}>{t('privacy.storedHeading')}</h2>
        <p className={BODY_CLASSES}>{t('privacy.storedBody')}</p>
      </section>

      <section data-testid="privacy-errors" className="flex flex-col gap-3">
        <h2 className={HEADING_CLASSES}>{t('privacy.errorsHeading')}</h2>
        <p className={BODY_CLASSES}>{t('privacy.errorsBody')}</p>
      </section>

      <section data-testid="privacy-analytics" className="flex flex-col gap-3">
        <h2 className={HEADING_CLASSES}>{t('privacy.analyticsHeading')}</h2>
        <p className={BODY_CLASSES}>{t('privacy.analyticsBody')}</p>
      </section>
    </main>
  );
}
