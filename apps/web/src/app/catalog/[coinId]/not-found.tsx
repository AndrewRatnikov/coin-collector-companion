import { CoinNotFoundView } from '@/components/catalog/coin-not-found-view';

/**
 * Malformed id, API 404/400 or a coin that isn't approved: the page calls notFound() and Next.js
 * sends the 404 status. A signed-in submitter still sees their own coin after mount.
 */
export default function CoinNotFound() {
  return <CoinNotFoundView />;
}
