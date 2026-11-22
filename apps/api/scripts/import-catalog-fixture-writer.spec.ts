import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  FixtureFormatError,
  formatImageBlock,
  setCoinImages,
} from '../../../scripts/import-catalog/lib/fixture-writer';
import type { RawCoinImage } from '../../../scripts/import-catalog/lib/types';

// CONTRACT_GAPs: none
// The sample fixture is read from __fixtures__/commons (a test input); nothing is written.

const SAMPLE = fs.readFileSync(path.join(__dirname, '__fixtures__/commons/fixture-ukraine-sample.json'), 'utf8');

const INDENT = '      ';

function imageFor(name: string): RawCoinImage {
  return {
    url: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/${name}.jpg/500px-${name}.jpg`,
    source: `Creator of ${name}`,
    license: 'Public domain',
    copyrighted: false,
    attributionRequired: false,
  };
}

function insertion(image: RawCoinImage): string {
  return `,\n${INDENT}"image": ${formatImageBlock(image, INDENT)}`;
}

describe('formatImageBlock', () => {
  it('is JSON with two-space steps and every line after the first prefixed by the indent', () => {
    expect(formatImageBlock({ url: 'u', source: 's' }, '  ')).toBe('{\n    "url": "u",\n    "source": "s"\n  }');
  });

  it('writes the keys it is given, in order, and no others', () => {
    expect(formatImageBlock({ url: 'u' }, '')).toBe('{\n  "url": "u"\n}');
    expect(
      formatImageBlock(
        { url: 'u', source: 's', license: 'l', copyrighted: false, attributionRequired: false },
        '\t',
      ),
    ).toBe(
      '{\n\t  "url": "u",\n\t  "source": "s",\n\t  "license": "l",\n\t  "copyrighted": false,\n\t  "attributionRequired": false\n\t}',
    );
  });

  it('round-trips through JSON.parse', () => {
    const image = imageFor('A');
    expect(JSON.parse(formatImageBlock(image, INDENT))).toEqual(image);
  });
});

describe('setCoinImages', () => {
  it('uses a sample the JSON round trip would change (4.0 and 3.0)', () => {
    expect(JSON.stringify(JSON.parse(SAMPLE), null, 2)).not.toBe(SAMPLE.trimEnd());
    expect(SAMPLE).toContain('"weightG": 4.0');
  });

  it('returns the text unchanged for an empty map', () => {
    expect(setCoinImages(SAMPLE, new Map())).toBe(SAMPLE);
  });

  it('adds an image block to the chosen coin and leaves every other byte alone', () => {
    const image = imageFor('A');

    const result = setCoinImages(SAMPLE, new Map([[0, image]]));

    expect(result).not.toBe(SAMPLE);
    expect(result.replace(insertion(image), '')).toBe(SAMPLE);
    const parsed = JSON.parse(result);
    expect(parsed.coins[0].image).toEqual(image);
    expect(parsed.coins[0].variety).toBe('Defenders of Donetsk Airport');
  });

  it('puts the block after the last member of a coin, whatever that member is', () => {
    // index 2 ends with a nested `specs` object, index 3 and 4 with a string, index 0 with a number
    for (const index of [0, 2, 3, 4]) {
      const image = imageFor(`Coin${index}`);

      const result = setCoinImages(SAMPLE, new Map([[index, image]]));

      expect(result.replace(insertion(image), '')).toBe(SAMPLE);
      const coins = JSON.parse(result).coins;
      expect(coins[index].image).toEqual(image);
      coins.forEach((coin: { image?: RawCoinImage }, i: number) => {
        if (i !== index && i !== 1) expect(coin.image).toBeUndefined();
      });
    }
  });

  it('adds several blocks in one pass, each in its own coin', () => {
    const images = new Map<number, RawCoinImage>([
      [0, imageFor('First')],
      [2, imageFor('Third')],
      [4, imageFor('Fifth')],
    ]);

    const result = setCoinImages(SAMPLE, images);

    let restored = result;
    for (const image of images.values()) restored = restored.replace(insertion(image), '');
    expect(restored).toBe(SAMPLE);
    const coins = JSON.parse(result).coins;
    expect(coins[0].image).toEqual(images.get(0));
    expect(coins[2].image).toEqual(images.get(2));
    expect(coins[4].image).toEqual(images.get(4));
    expect(coins[3].image).toBeUndefined();
  });

  it('does not depend on the order the map was filled', () => {
    const forward = new Map<number, RawCoinImage>([
      [0, imageFor('First')],
      [4, imageFor('Fifth')],
    ]);
    const backward = new Map<number, RawCoinImage>([
      [4, imageFor('Fifth')],
      [0, imageFor('First')],
    ]);

    expect(setCoinImages(SAMPLE, backward)).toBe(setCoinImages(SAMPLE, forward));
  });

  it('keeps the numbers JSON.stringify would rewrite', () => {
    const result = setCoinImages(SAMPLE, new Map([[0, imageFor('A')], [3, imageFor('B')]]));

    expect(result).toContain('"weightG": 4.0');
    expect(result).toContain('"diameterMm": 27.0');
    expect(result).toContain('"weightG": 3.0');
  });

  it('keeps the sources block, even though its text mentions "coins": [', () => {
    const result = setCoinImages(SAMPLE, new Map([[0, imageFor('A')]]));

    expect(result).toContain('"note": "Inert text: \\"coins\\": [ } { ] stays untouched"');
    expect(JSON.parse(result).sources).toEqual(JSON.parse(SAMPLE).sources);
  });

  it('replaces an existing image in place', () => {
    const image = imageFor('New');
    const oldBlock =
      '{\n        "url": "https://upload.wikimedia.org/wikipedia/commons/old.jpg",\n        "source": "Old",\n        "license": "Public domain",\n        "copyrighted": false\n      }';
    expect(SAMPLE).toContain(oldBlock);

    const result = setCoinImages(SAMPLE, new Map([[1, image]]));

    expect(result.replace(formatImageBlock(image, INDENT), oldBlock)).toBe(SAMPLE);
    const coins = JSON.parse(result).coins;
    expect(coins[1].image).toEqual(image);
    expect(result.match(/"image":/g)).toHaveLength(1);
  });

  it('gives the parsed result the same data as the input plus the images', () => {
    const image = imageFor('A');
    const expected = JSON.parse(SAMPLE);
    expected.coins[3].image = image;

    expect(JSON.parse(setCoinImages(SAMPLE, new Map([[3, image]])))).toEqual(expected);
  });

  it('copies the indentation of the coin it writes into (tabs, trailing newline kept)', () => {
    const text = '{\n\t"country": "Ukraine",\n\t"coins": [\n\t\t{\n\t\t\t"year": 2018\n\t\t}\n\t]\n}\n';
    const image = imageFor('Tabbed');

    const result = setCoinImages(text, new Map([[0, image]]));

    expect(result).toBe(
      `{\n\t"country": "Ukraine",\n\t"coins": [\n\t\t{\n\t\t\t"year": 2018,\n\t\t\t"image": ${formatImageBlock(image, '\t\t\t')}\n\t\t}\n\t]\n}\n`,
    );
  });

  it('throws a FixtureFormatError when there is no root coins array', () => {
    expect(() => setCoinImages('{\n  "country": "Ukraine"\n}\n', new Map([[0, imageFor('A')]]))).toThrow(
      FixtureFormatError,
    );
    // a `coins` array nested inside another member is not the root one
    expect(() =>
      setCoinImages('{"sources": [{"coins": [{"a": 1}]}]}', new Map([[0, imageFor('A')]])),
    ).toThrow(FixtureFormatError);
  });

  it('throws a FixtureFormatError for an index out of range', () => {
    expect(() => setCoinImages(SAMPLE, new Map([[5, imageFor('A')]]))).toThrow(FixtureFormatError);
    expect(() => setCoinImages(SAMPLE, new Map([[-1, imageFor('A')]]))).toThrow(FixtureFormatError);
  });

  it('throws a FixtureFormatError when the coin is not a non-empty object', () => {
    expect(() => setCoinImages('{"coins": [{}]}', new Map([[0, imageFor('A')]]))).toThrow(FixtureFormatError);
    expect(() => setCoinImages('{"coins": [5]}', new Map([[0, imageFor('A')]]))).toThrow(FixtureFormatError);
  });

  it('names the error FixtureFormatError', () => {
    let error: unknown;
    try {
      setCoinImages('{"country": "Ukraine"}', new Map([[0, imageFor('A')]]));
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('FixtureFormatError');
  });
});
