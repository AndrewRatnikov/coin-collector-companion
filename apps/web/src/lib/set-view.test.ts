/**
 * Tests for: set-view (pure ?view= helpers)
 * Contract source: runs/run_20261009_211156/plan.md § Interface Contract → Module: set-view
 * Covers criteria: #2, #19
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { buildSetViewSearch, parseSetView } from '@/lib/set-view';

describe('parseSetView', () => {
  it("returns 'album' only for view=album", () => {
    expect(parseSetView('?view=album')).toBe('album');
    expect(parseSetView('?x=1&view=album')).toBe('album');
    expect(parseSetView('view=album')).toBe('album');
  });

  it("falls back to 'list' for missing, empty or invalid values", () => {
    expect(parseSetView('')).toBe('list');
    expect(parseSetView('?')).toBe('list');
    expect(parseSetView('?view=')).toBe('list');
    expect(parseSetView('?view=grid')).toBe('list');
    expect(parseSetView('?view=ALBUM')).toBe('list');
    expect(parseSetView('?view=list')).toBe('list');
    expect(parseSetView('?x=1')).toBe('list');
  });
});

describe('buildSetViewSearch', () => {
  it('sets view=album', () => {
    expect(buildSetViewSearch('', 'album')).toBe('?view=album');
    expect(buildSetViewSearch('?x=1', 'album')).toBe('?x=1&view=album');
  });

  it('removes view for list and returns an empty string when nothing remains', () => {
    expect(buildSetViewSearch('?view=album', 'list')).toBe('');
    expect(buildSetViewSearch('?x=1&view=album', 'list')).toBe('?x=1');
    expect(buildSetViewSearch('', 'list')).toBe('');
  });

  it('preserves other params and does not duplicate view', () => {
    expect(buildSetViewSearch('?view=album&y=2', 'album')).toBe('?view=album&y=2');
    expect(buildSetViewSearch('?a=1&b=2', 'list')).toBe('?a=1&b=2');
  });

  it('round-trips with parseSetView', () => {
    expect(parseSetView(buildSetViewSearch('?x=1', 'album'))).toBe('album');
    expect(parseSetView(buildSetViewSearch('?x=1&view=album', 'list'))).toBe('list');
  });
});
