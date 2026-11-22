import type { RawCoinImage } from './types';

// Writes `image` blocks into a fixture's text without re-serialising it: JSON.stringify
// would rewrite numbers such as `4.0` and turn a reviewed fixture's diff into noise. A
// small scanner finds the root object's `coins` array and each coin's member spans; the
// block is inserted after the coin's last member (or replaces an existing `image`
// value). Every other byte stays as it was.

export class FixtureFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FixtureFormatError';
  }
}

// JSON with two-space steps; every line after the first is prefixed by `indent`.
export function formatImageBlock(image: RawCoinImage, indent: string): string {
  return JSON.stringify(image, null, 2).split('\n').join(`\n${indent}`);
}

interface Member {
  key: string;
  keyStart: number;
  valueStart: number;
  valueEnd: number;
}

interface ElementSpan {
  start: number;
  end: number;
  // set only when the element is an object
  members: Member[] | null;
}

class Scanner {
  constructor(private readonly text: string) {}

  fail(message: string, at: number): never {
    throw new FixtureFormatError(`${message} at offset ${at}`);
  }

  skipWs(pos: number): number {
    let p = pos;
    while (p < this.text.length && /\s/.test(this.text[p])) p += 1;
    return p;
  }

  // Returns the offset just after the closing quote.
  string(pos: number): number {
    if (this.text[pos] !== '"') this.fail('Expected a string', pos);
    let p = pos + 1;
    while (p < this.text.length) {
      const ch = this.text[p];
      if (ch === '\\') p += 2;
      else if (ch === '"') return p + 1;
      else p += 1;
    }
    return this.fail('Unterminated string', pos);
  }

  // Returns the offset just after the value.
  value(pos: number): number {
    const ch = this.text[pos];
    if (ch === '"') return this.string(pos);
    if (ch === '{') return this.object(pos).end;
    if (ch === '[') return this.array(pos).end;
    let p = pos;
    while (p < this.text.length && !/[\s,\]}]/.test(this.text[p])) p += 1;
    if (p === pos) this.fail('Expected a value', pos);
    return p;
  }

  object(pos: number): { end: number; members: Member[] } {
    if (this.text[pos] !== '{') this.fail('Expected an object', pos);
    const members: Member[] = [];
    let p = this.skipWs(pos + 1);
    if (this.text[p] === '}') return { end: p + 1, members };
    for (;;) {
      const keyStart = p;
      const keyEnd = this.string(p);
      const key = JSON.parse(this.text.slice(keyStart, keyEnd)) as string;
      p = this.skipWs(keyEnd);
      if (this.text[p] !== ':') this.fail('Expected ":"', p);
      const valueStart = this.skipWs(p + 1);
      const valueEnd = this.value(valueStart);
      members.push({ key, keyStart, valueStart, valueEnd });
      p = this.skipWs(valueEnd);
      if (this.text[p] === ',') {
        p = this.skipWs(p + 1);
        continue;
      }
      if (this.text[p] === '}') return { end: p + 1, members };
      this.fail('Expected "," or "}"', p);
    }
  }

  array(pos: number): { end: number; elements: ElementSpan[] } {
    if (this.text[pos] !== '[') this.fail('Expected an array', pos);
    const elements: ElementSpan[] = [];
    let p = this.skipWs(pos + 1);
    if (this.text[p] === ']') return { end: p + 1, elements };
    for (;;) {
      const start = p;
      let end: number;
      let members: Member[] | null = null;
      if (this.text[p] === '{') {
        const parsed = this.object(p);
        end = parsed.end;
        members = parsed.members;
      } else {
        end = this.value(p);
      }
      elements.push({ start, end, members });
      p = this.skipWs(end);
      if (this.text[p] === ',') {
        p = this.skipWs(p + 1);
        continue;
      }
      if (this.text[p] === ']') return { end: p + 1, elements };
      this.fail('Expected "," or "]"', p);
    }
  }
}

function findCoins(text: string): ElementSpan[] {
  const scanner = new Scanner(text);
  const start = scanner.skipWs(0);
  if (text[start] !== '{') throw new FixtureFormatError('The fixture is not a JSON object');
  const root = scanner.object(start);
  const coins = root.members.find((m) => m.key === 'coins');
  if (!coins || text[coins.valueStart] !== '[') {
    throw new FixtureFormatError('The fixture has no root "coins" array');
  }
  return scanner.array(coins.valueStart).elements;
}

// The whitespace before the coin's first key, when that key starts its own line.
function indentOf(text: string, element: ElementSpan, firstKeyStart: number): string {
  const lineStart = text.lastIndexOf('\n', firstKeyStart - 1) + 1;
  if (lineStart <= element.start) return '';
  const lead = text.slice(lineStart, firstKeyStart);
  return /^[ \t]*$/.test(lead) ? lead : '';
}

export function setCoinImages(text: string, images: ReadonlyMap<number, RawCoinImage>): string {
  if (images.size === 0) return text;
  const coins = findCoins(text);

  const indices = [...images.keys()].sort((a, b) => b - a);
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= coins.length) {
      throw new FixtureFormatError(`Coin index ${index} is out of range (the fixture has ${coins.length} coins)`);
    }
    const members = coins[index].members;
    if (!members || members.length === 0) {
      throw new FixtureFormatError(`Coin #${index} is not a non-empty object`);
    }
  }

  let result = text;
  for (const index of indices) {
    const element = coins[index];
    const members = element.members as Member[];
    const image = images.get(index) as RawCoinImage;
    const indent = indentOf(text, element, members[0].keyStart);
    const existing = members.find((m) => m.key === 'image');
    if (existing) {
      result = `${result.slice(0, existing.valueStart)}${formatImageBlock(image, indent)}${result.slice(existing.valueEnd)}`;
    } else {
      const at = members[members.length - 1].valueEnd;
      result = `${result.slice(0, at)},\n${indent}"image": ${formatImageBlock(image, indent)}${result.slice(at)}`;
    }
  }
  return result;
}
