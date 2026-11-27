import type {
  CanonicalSetSummary,
  CatalogListItem,
  PaginatedResponse,
  PublicSetSummary,
} from '@coin-collector/shared';
import type { MetadataRoute } from 'next';
import { serverApiGet } from '@/lib/server-api';
import { siteOrigin } from '@/lib/site-url';

// Never prerendered at build time (the build must not call the API) and never stored, so a
// degraded sitemap from a sleeping API isn't reused. The API responses are still cached by
// serverApiGet's data-cache revalidate.
export const dynamic = 'force-dynamic';

type Entry = MetadataRoute.Sitemap[number];

const PAGE_SIZE = 100;

/** Fetches every page of a paginated public list. Rejects if any page fails. */
async function fetchAllPages<T>(basePath: string): Promise<T[]> {
  const first = await serverApiGet<PaginatedResponse<T>>(`${basePath}?page=1&limit=${PAGE_SIZE}`);
  const pageSize = typeof first.limit === 'number' && first.limit > 0 ? first.limit : PAGE_SIZE;
  const pages = Math.ceil(first.total / pageSize);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      serverApiGet<PaginatedResponse<T>>(`${basePath}?page=${i + 2}&limit=${PAGE_SIZE}`),
    ),
  );
  return [first, ...rest].flatMap((page) => page.items);
}

async function checklistEntries(origin: string): Promise<Entry[]> {
  try {
    const lists = await serverApiGet<CanonicalSetSummary[]>('/sets/canonical');
    return lists.map((item) => ({ url: `${origin}/sets/canonical/${item.id}` }));
  } catch {
    return [];
  }
}

async function publicSetEntries(origin: string): Promise<Entry[]> {
  try {
    const sets = await fetchAllPages<PublicSetSummary>('/sets/public');
    return sets.map((item) => ({ url: `${origin}/sets/public/${item.id}`, lastModified: item.updatedAt }));
  } catch {
    return [];
  }
}

async function coinEntries(origin: string): Promise<Entry[]> {
  try {
    // The anonymous catalog list returns approved coins only; the status check is a second guard,
    // because a pending or rejected coin page is a 404.
    const coins = await fetchAllPages<CatalogListItem>('/catalog');
    return coins.filter((item) => item.status === 'approved').map((item) => ({ url: `${origin}/catalog/${item.id}`, lastModified: item.updatedAt }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const staticEntries: Entry[] = [
    { url: `${origin}/` },
    { url: `${origin}/catalog` },
    { url: `${origin}/glossary` },
    { url: `${origin}/privacy` },
    { url: `${origin}/sets/canonical` },
    { url: `${origin}/sets/public` },
  ];
  const [checklists, publicSets, coins] = await Promise.all([
    checklistEntries(origin),
    publicSetEntries(origin),
    coinEntries(origin),
  ]);
  return [...staticEntries, ...checklists, ...publicSets, ...coins];
}
