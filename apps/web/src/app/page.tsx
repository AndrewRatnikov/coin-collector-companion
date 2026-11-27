'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AccountDeletedNotice } from '@/components/settings/account-deleted-notice';
import { Coverage } from '@/components/landing/coverage';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingPoints } from '@/components/landing/landing-points';
import { WaysIn } from '@/components/landing/ways-in';
import { WebsiteJsonLd } from '@/components/seo/website-json-ld';
import { getStoredToken } from '@/lib/auth-token';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePublicSets } from '@/lib/hooks/use-public-sets';
import { useSlowLoading } from '@/lib/hooks/use-slow-loading';
import { getCoverageCounts, getFullChecklistHref } from '@/lib/landing/landing-data';

export default function Home() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  // Signed-in visitors land on My sets. The session lives in localStorage, so this can
  // only happen in the browser after mount (same pattern as RequireAuth). `replace`, not
  // `push`, so Back doesn't bounce through `/`. The ref guard makes the redirect fire once
  // per mount even if the router object identity changes between renders.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (redirectedRef.current) return;
    if (getStoredToken()) {
      redirectedRef.current = true;
      setRedirecting(true);
      router.replace('/dashboard');
    }
  }, [router]);

  const catalog = useCatalog({ page: 1, limit: 1 });
  const canonicalSets = useCanonicalSets();
  const publicSets = usePublicSets({ page: 1, limit: 1 });

  const showWaking = useSlowLoading(catalog.isLoading || canonicalSets.isLoading || publicSets.isLoading);
  const compact = useMediaQuery('(max-width: 899px)');
  const coverage = getCoverageCounts(canonicalSets.data);
  const isError = catalog.isError || canonicalSets.isError || publicSets.isError;

  function retryCounts() {
    void catalog.refetch();
    void canonicalSets.refetch();
    void publicSets.refetch();
  }

  if (redirecting) {
    return <main data-testid="home-redirecting" className="flex-1" />;
  }

  // The demo is static sample data and never waits on these queries; only the ways-in counts,
  // the full-checklist link and the coverage numbers come from the API.
  return (
    <main data-testid="home-page" className="flex w-full flex-1 flex-col">
      <WebsiteJsonLd />
      <div className="mx-auto w-full max-w-[1320px] px-5 pt-6 empty:hidden min-[900px]:px-10">
        <AccountDeletedNotice />
      </div>
      <LandingHero
        interactive={false}
        compact={compact}
        setCoinCount={coverage.coins}
        fullChecklistHref={getFullChecklistHref(canonicalSets.data)}
      />
      <LandingPoints />
      <WaysIn
        catalogCount={catalog.data?.total ?? null}
        checklistCount={canonicalSets.data?.length ?? null}
        publicSetCount={publicSets.data?.total ?? null}
        isError={isError}
        showWaking={showWaking}
        onRetry={retryCounts}
        compact={compact}
      />
      <Coverage counts={coverage} />
    </main>
  );
}
