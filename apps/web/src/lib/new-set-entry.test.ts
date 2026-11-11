import { describe, expect, it } from 'vitest';

import { readEntry, type EntryParams } from '@/lib/new-set-entry';

describe('readEntry', () => {
  it('returns null/empty when there are no params', () => {
    const result: EntryParams = readEntry(new URLSearchParams(''));
    expect(result).toEqual({ cloneFrom: null, cloneFromId: '' });
  });

  it('reads canonical with an id', () => {
    expect(readEntry(new URLSearchParams('cloneFrom=canonical&cloneFromId=abc'))).toEqual({
      cloneFrom: 'canonical',
      cloneFromId: 'abc',
    });
  });

  it('reads user with an id', () => {
    expect(readEntry(new URLSearchParams('cloneFrom=user&cloneFromId=xyz'))).toEqual({
      cloneFrom: 'user',
      cloneFromId: 'xyz',
    });
  });

  it('gives an empty id when cloneFrom is valid but the id is absent or empty', () => {
    expect(readEntry(new URLSearchParams('cloneFrom=canonical'))).toEqual({
      cloneFrom: 'canonical',
      cloneFromId: '',
    });
    expect(readEntry(new URLSearchParams('cloneFrom=user&cloneFromId='))).toEqual({
      cloneFrom: 'user',
      cloneFromId: '',
    });
  });

  it.each(['public', 'Canonical', 'USER', ''])(
    'ignores the id when cloneFrom is invalid (%j)',
    (value) => {
      const params = new URLSearchParams({ cloneFrom: value, cloneFromId: 'abc' });
      expect(readEntry(params)).toEqual({ cloneFrom: null, cloneFromId: '' });
    },
  );

  it('ignores cloneFromId when cloneFrom is absent', () => {
    expect(readEntry(new URLSearchParams('cloneFromId=abc'))).toEqual({
      cloneFrom: null,
      cloneFromId: '',
    });
  });

  it('works with a plain { get } object', () => {
    const values: Record<string, string> = { cloneFrom: 'user', cloneFromId: 'plain-1' };
    const result = readEntry({ get: (name) => values[name] ?? null });
    expect(result).toEqual({ cloneFrom: 'user', cloneFromId: 'plain-1' });

    expect(readEntry({ get: () => null })).toEqual({ cloneFrom: null, cloneFromId: '' });
  });

  it('returns the id as-is without validation or trimming', () => {
    expect(readEntry(new URLSearchParams('cloneFrom=canonical&cloneFromId=not-a-uuid'))).toEqual({
      cloneFrom: 'canonical',
      cloneFromId: 'not-a-uuid',
    });
    expect(readEntry(new URLSearchParams('cloneFrom=user&cloneFromId=a%20b'))).toEqual({
      cloneFrom: 'user',
      cloneFromId: 'a b',
    });
  });

  it('uses the first value when keys are duplicated', () => {
    expect(
      readEntry(new URLSearchParams('cloneFrom=user&cloneFrom=canonical&cloneFromId=1&cloneFromId=2')),
    ).toEqual({ cloneFrom: 'user', cloneFromId: '1' });
  });
});
