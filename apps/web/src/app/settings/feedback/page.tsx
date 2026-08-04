'use client';

import { RequireAuth } from '@/components/auth/require-auth';
import { SettingsTabs } from '@/components/layout/settings-tabs';
import { FeedbackForm } from '@/components/settings/feedback-form';
import { useTranslation } from '@/lib/i18n/i18n-context';

function SettingsFeedbackContent() {
  const { t } = useTranslation();

  return (
    <main
      data-testid="settings-feedback-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
    >
      <SettingsTabs />

      <h1 className="text-[28px] font-normal [font-family:var(--font-heading)]">{t('settings.title')}</h1>

      <FeedbackForm />
    </main>
  );
}

export default function SettingsFeedbackPage() {
  return (
    <RequireAuth>
      <SettingsFeedbackContent />
    </RequireAuth>
  );
}
