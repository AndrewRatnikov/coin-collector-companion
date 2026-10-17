/**
 * Tests for: set-view (pure ?view= helpers)
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → apps/web/src/lib/set-view.ts
 * Covers criteria: #1
 *
 * Album is now the default; only view=list selects List. The previous run's tests (List default,
 * view=album param) describe behaviour this run removes, so they are replaced here.
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { buildSetViewSearch, parseSetView } from '@/lib/set-view';

describe('parseSetView', () => {
  it("returns 'list' only for view=list", () => {
    expect(parseSetView('?view=list')).toBe('list');
    expect(parseSetView('?x=1&view=list')).toBe('list');
    expect(parseSetView('view=list')).toBe('list');
  });

  it("falls back to 'album' for missing, empty or invalid values", () => {
    expect(parseSetView('')).toBe('album');
    expect(parseSetView('?')).toBe('album');
    expect(parseSetView('?view=')).toBe('album');
    expect(parseSetView('?view=grid')).toBe('album');
    expect(parseSetView('?view=LIST')).toBe('album');
    expect(parseSetView('?view=album')).toBe('album');
    expect(parseSetView('?x=1')).toBe('album');
  });
});

describe('buildSetViewSearch', () => {
  it('sets view=list', () => {
    expect(buildSetViewSearch('', 'list')).toBe('?view=list');
    expect(buildSetViewSearch('?x=1', 'list')).toBe('?x=1&view=list');
  });

  it('removes view for album and returns an empty string when nothing remains', () => {
    expect(buildSetViewSearch('?view=list', 'album')).toBe('');
    expect(buildSetViewSearch('?x=1&view=list', 'album')).toBe('?x=1');
    expect(buildSetViewSearch('', 'album')).toBe('');
  });

  it('preserves other params and does not duplicate view', () => {
    expect(buildSetViewSearch('?view=list&y=2', 'list')).toBe('?view=list&y=2');
    expect(buildSetViewSearch('?a=1&b=2', 'album')).toBe('?a=1&b=2');
  });

  it('round-trips with parseSetView', () => {
    expect(parseSetView(buildSetViewSearch('?x=1', 'list'))).toBe('list');
    expect(parseSetView(buildSetViewSearch('?x=1&view=list', 'album'))).toBe('album');
  });
});
