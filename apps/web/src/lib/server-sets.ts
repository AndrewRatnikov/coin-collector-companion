import 'server-only';

import { cache } from 'react';
import type { CanonicalSetDetail, CanonicalSetSummary, UserSetDetail } from '@coin-collector/shared';
import { LIST_REVALIDATE_SECONDS, ServerApiError, serverApiGet } from '@/lib/server-api';

/**
 * Server-side loaders for the checklist and public set pages. Each one is shared by the page and
 * its generateMetadata through React cache(), so a render costs one API request (failed fetches
 * are not kept in the data cache). They never throw: the page decides what a failure means.
 */
export type ServerLoad<T> = { status: 'ok'; data: T } | { status: 'not-found' } | { status: 'unavailable' };

/** A 404 (missing or deleted set) or 400 (malformed id, ParseUUIDPipe) means the set doesn't exist. */
function isNotFound(error: unknown): boolean {
  return (
    error instanceof ServerApiError &&
    error.kind === 'http' &&
    (error.status === 404 || error.status === 400)
  );
}

async function loadDetail<T>(path: string): Promise<ServerLoad<T>> {
  try {
    const data = await serverApiGet<T>(path, { revalidate: LIST_REVALIDATE_SECONDS });
    return { status: 'ok', data };
  } catch (error) {
    return isNotFound(error) ? { status: 'not-found' } : { status: 'unavailable' };
  }
}

export const loadCanonicalSets = cache(async (): Promise<ServerLoad<CanonicalSetSummary[]>> => {
  try {
    const data = await serverApiGet<CanonicalSetSummary[]>('/sets/canonical', {
      revalidate: LIST_REVALIDATE_SECONDS,
    });
    return { status: 'ok', data };
  } catch {
    return { status: 'unavailable' };
  }
});

export const loadCanonicalSet = cache(
  (id: string): Promise<ServerLoad<CanonicalSetDetail>> =>
    loadDetail<CanonicalSetDetail>(`/sets/canonical/${encodeURIComponent(id)}`),
);

export const loadPublicSet = cache(
  (id: string): Promise<ServerLoad<UserSetDetail>> =>
    loadDetail<UserSetDetail>(`/sets/public/${encodeURIComponent(id)}`),
);
