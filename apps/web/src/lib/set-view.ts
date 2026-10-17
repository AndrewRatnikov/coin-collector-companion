export type SetView = 'list' | 'album';

/** `'list'` only for `view=list`; anything else (including no param) is the default `'album'`. */
export function parseSetView(search: string): SetView {
  return new URLSearchParams(search).get('view') === 'list' ? 'list' : 'album';
}

/**
 * Returns the new search string for `view`, keeping every other param.
 * Includes the leading `?`, or is `''` when no params remain.
 */
export function buildSetViewSearch(search: string, view: SetView): string {
  const params = new URLSearchParams(search);
  if (view === 'list') {
    params.set('view', 'list');
  } else {
    params.delete('view');
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
