import { describe, expect, it } from 'vitest';
import { fill } from './fill-template';

/** The old sets/new `fillCount`, kept to show `fill(t, { count })` is equivalent. */
function legacyFillCount(template: string, n: number): string {
  return template.split('{count}').join(String(n));
}

describe('fill', () => {
  it('replaces a single placeholder', () => {
    expect(fill('Hello {name}!', { name: 'Ana' })).toBe('Hello Ana!');
    expect(fill('Hello {name}!', { name: 'Bob' })).toBe('Hello Bob!');
  });

  it('replaces several different placeholders', () => {
    expect(fill('{a} of {b} in {c}', { a: 'x', b: 'y', c: 'z' })).toBe('x of y in z');
    expect(fill('{a} of {b} in {c}', { a: '1', b: '2', c: '3' })).toBe('1 of 2 in 3');
  });

  it('replaces a repeated placeholder everywhere', () => {
    expect(fill('{n} and {n} and {n}', { n: 7 })).toBe('7 and 7 and 7');
  });

  it('stringifies number values, including zero', () => {
    expect(fill('{count} coins', { count: 12 })).toBe('12 coins');
    expect(fill('{count} coins', { count: 0 })).toBe('0 coins');
  });

  it('leaves placeholders with no matching key as they are', () => {
    expect(fill('{a} and {x}', { a: 'one' })).toBe('one and {x}');
  });

  it('returns the template unchanged for an empty values object', () => {
    expect(fill('Hello {name}', {})).toBe('Hello {name}');
    expect(fill('plain text', {})).toBe('plain text');
  });

  it('matches the old fillCount for { count }', () => {
    for (const [template, n] of [
      ['{count} coins', 3],
      ['{count} of {count} / {other}', 250],
    ] as const) {
      expect(fill(template, { count: n })).toBe(legacyFillCount(template, n));
    }
  });
});
