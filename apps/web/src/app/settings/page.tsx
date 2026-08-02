'use client';

import { RequireAuth } from '@/components/auth/require-auth';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useTranslation } from '@/lib/i18n/i18n-context';

function SettingsContent() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useCurrentUser();

  return (
    <main
      data-testid="settings-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
    >
      <h1 className="text-[28px] font-normal [font-family:var(--font-heading)]">{t('settings.title')}</h1>

      {isLoading && (
        <div data-testid="settings-loading">
          <ListSkeleton />
        </div>
      )}

      {isError && (
        <p data-testid="settings-error" className="text-sm text-red-700">
          {t('common.somethingWentWrong')}
        </p>
      )}

      {data && (
        <div data-testid="settings-account-info" className="flex flex-col gap-2 border-t border-[var(--color-divider)] pt-6">
          <p data-testid="settings-email" className="text-sm">
            {t('settings.emailLabel')}: {data.email}
          </p>
          <p data-testid="settings-member-since" className="text-sm text-[var(--color-neutral-600)]">
            {t('settings.memberSinceLabel')}: {new Date(data.createdAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </main>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}
