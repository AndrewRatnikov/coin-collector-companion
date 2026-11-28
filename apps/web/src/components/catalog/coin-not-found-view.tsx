'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CoinDetailView } from '@/components/catalog/coin-detail-view';
import { NotFoundContent } from '@/components/ui/not-found-content';
import { getStoredToken } from '@/lib/auth-token';
import { coinIdFromPathname } from '@/lib/coin-page';

/**
 * The coin segment's 404 content. The server HTML is always the anonymous branch (no coin data).
 * After mount, a signed-in visitor gets the client coin view for the path's id, so a submitter
 * still sees their own pending or rejected coin, fetched in the browser with their token.
 */
export function CoinNotFoundView() {
  const coinId = coinIdFromPathname(usePathname());
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getStoredToken()));
  }, []);

  if (isLoggedIn && coinId) {
    return <CoinDetailView coinId={coinId} />;
  }

  return (
    <main
      data-testid="coin-not-found-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-[clamp(20px,5vw,48px)] py-10"
    >
      <NotFoundContent variant="coin" />
    </main>
  );
}
