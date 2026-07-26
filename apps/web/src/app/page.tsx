'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';

export default function Home() {
  const { t } = useTranslation();

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <p>{t('home.title')}</p>
    </main>
  );
}
