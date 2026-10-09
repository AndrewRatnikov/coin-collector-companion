export type SetView = 'list' | 'album';

/** `'album'` only for `view=album`; anything else falls back to `'list'`. */
export function parseSetView(search: string): SetView {
  return new URLSearchParams(search).get('view') === 'album' ? 'album' : 'list';
}

/**
 * Returns the new search string for `view`, keeping every other param.
 * Includes the leading `?`, or is `''` when no params remain.
 */
export function buildSetViewSearch(search: string, view: SetView): string {
  const params = new URLSearchParams(search);
  if (view === 'album') {
    params.set('view', 'album');
  } else {
    params.delete('view');
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
