import type { CommonsFile, CommonsImageInfo } from '../../../scripts/import-catalog/lib/commons';
import {
  MAX_ASPECT,
  MIN_ASPECT,
  buildCoinQueries,
  chooseImage,
  detectSide,
  fileText,
  findTextCandidates,
  hasCommemorativeMarker,
  normalizeText,
  parseDenomination,
  subjectTokens,
  tokenize,
} from '../../../scripts/import-catalog/lib/image-match';
import type { CoinQuery, LoadedFixture } from '../../../scripts/import-catalog/lib/image-match';
import type { RawFixtureFile } from '../../../scripts/import-catalog/lib/types';

// CONTRACT_GAPs: none
// Pure functions only: no network, no filesystem.

function query(over: Partial<CoinQuery> = {}): CoinQuery {
  return {
    file: 'fixtures/ukraine-x.json',
    index: 0,
    country: 'Ukraine',
    denomination: '10 Hryvnias',
    year: 2018,
    variety: null,
    titleUk: null,
    commemorative: false,
    hasImage: false,
    siblingSubjects: [],
    sameKindSiblings: 0,
    ...over,
  };
}

function file(title: string, categories: string[] = []): CommonsFile {
  return { title, categories };
}

const WIKI = 'https://upload.wikimedia.org/wikipedia/commons/x/xx/';

const PUBLIC_DOMAIN = {
  Artist: 'Ivan',
  LicenseShortName: 'Public domain',
  Copyrighted: 'False',
  AttributionRequired: 'false',
};

const CC_BY_SA = {
  Artist: 'Olena',
  LicenseShortName: 'CC BY-SA 4.0',
  Copyrighted: 'True',
  AttributionRequired: 'true',
};

function info(
  title: string,
  extmetadata: Record<string, string> = PUBLIC_DOMAIN,
  over: Partial<CommonsImageInfo> = {},
): CommonsImageInfo {
  return {
    title,
    url: `${WIKI}${encodeURIComponent(title.replace('File:', ''))}`,
    width: 1000,
    height: 1000,
    mime: 'image/jpeg',
    extmetadata,
    ...over,
  };
}

function mapOf(...infos: CommonsImageInfo[]): Map<string, CommonsImageInfo> {
  return new Map(infos.map((i) => [i.title, i]));
}

function parseFixture(json: string): RawFixtureFile {
  return JSON.parse(json);
}

describe('constants', () => {
  it('accepts squarish files only: aspect 0.8 to 1.25', () => {
    expect(MIN_ASPECT).toBe(0.8);
    expect(MAX_ASPECT).toBe(1.25);
  });
});

describe('normalizeText and tokenize', () => {
  it('lowercases and turns punctuation into spaces', () => {
    expect(normalizeText('10-Hryvnias_2018.jpg')).toBe('10 hryvnias 2018 jpg');
  });

  it('drops apostrophes instead of splitting on them', () => {
    expect(normalizeText('Donetsk’s Airport')).toBe('donetsks airport');
    expect(normalizeText("Donetsk's Airport")).toBe('donetsks airport');
    expect(normalizeText('Donetskʼs Airport')).toBe('donetsks airport');
  });

  it('collapses runs of spaces and trims', () => {
    expect(normalizeText('  Defenders   of  Donetsk!  ')).toBe('defenders of donetsk');
  });

  it('keeps Cyrillic letters and digits', () => {
    expect(normalizeText('Захисникам Донецького 2018')).toBe('захисникам донецького 2018');
  });

  it('applies NFKC (full-width letters become plain)', () => {
    expect(normalizeText('ＡＢＣ１２')).toBe('abc12');
  });

  it('tokenizes on the normalised text', () => {
    expect(tokenize('Zaporozhian  Sich-2020')).toEqual(['zaporozhian', 'sich', '2020']);
    expect(tokenize('Hryvnia')).toEqual(['hryvnia']);
  });
});

describe('parseDenomination', () => {
  it('reads hryvnias in English spellings', () => {
    expect(parseDenomination('10 Hryvnias')).toEqual({ value: 10, unit: 'hryvnia' });
    expect(parseDenomination('1 Hryvnia')).toEqual({ value: 1, unit: 'hryvnia' });
    expect(parseDenomination('2 Hryvni')).toEqual({ value: 2, unit: 'hryvnia' });
    expect(parseDenomination('5 hrivnas')).toEqual({ value: 5, unit: 'hryvnia' });
  });

  it('reads kopiykas in English spellings', () => {
    expect(parseDenomination('50 Kopiyok')).toEqual({ value: 50, unit: 'kopiyka' });
    expect(parseDenomination('1 Kopiyka')).toEqual({ value: 1, unit: 'kopiyka' });
    expect(parseDenomination('25 kopeks')).toEqual({ value: 25, unit: 'kopiyka' });
  });

  it('reads Ukrainian units', () => {
    expect(parseDenomination('10 гривень')).toEqual({ value: 10, unit: 'hryvnia' });
    expect(parseDenomination('2 гривні')).toEqual({ value: 2, unit: 'hryvnia' });
    expect(parseDenomination('5 грн')).toEqual({ value: 5, unit: 'hryvnia' });
    expect(parseDenomination('1 копійка')).toEqual({ value: 1, unit: 'kopiyka' });
    expect(parseDenomination('50 коп')).toEqual({ value: 50, unit: 'kopiyka' });
  });

  it('reads a number glued to its unit', () => {
    expect(parseDenomination('10kopiyok')).toEqual({ value: 10, unit: 'kopiyka' });
  });

  it('takes the first number that is followed by a unit, skipping the year', () => {
    expect(parseDenomination('Ukraine 2018 10 hryvnias reverse')).toEqual({ value: 10, unit: 'hryvnia' });
    expect(parseDenomination('50 kopiyok 1 hryvnia')).toEqual({ value: 50, unit: 'kopiyka' });
  });

  it('is null when no number is followed by a unit', () => {
    expect(parseDenomination('Ukraine 2018 coin')).toBeNull();
    expect(parseDenomination('hryvnia 10')).toBeNull();
    expect(parseDenomination('')).toBeNull();
  });
});

describe('subjectTokens', () => {
  it('keeps the meaningful words', () => {
    expect(subjectTokens('Defenders of Donetsk Airport')).toEqual(['defenders', 'donetsk', 'airport']);
  });

  it('drops stopwords and tokens shorter than 3 characters', () => {
    expect(subjectTokens('The Battle of the Sich')).toEqual(['battle', 'sich']);
    expect(subjectTokens('Ox')).toEqual([]);
  });

  it('keeps numbers of 3 or more digits and works on Cyrillic', () => {
    expect(subjectTokens('Hero of 1943')).toEqual(['hero', '1943']);
    expect(subjectTokens('Захисникам Донецького аеропорту')).toEqual(['захисникам', 'донецького', 'аеропорту']);
  });
});

describe('hasCommemorativeMarker', () => {
  it('spots commemorative and anniversary words in English and Ukrainian', () => {
    expect(hasCommemorativeMarker('10 hryvnias 2018 commemorative coin')).toBe(true);
    expect(hasCommemorativeMarker('25th anniversary of independence')).toBe(true);
    expect(hasCommemorativeMarker('Памятна монета')).toBe(true);
    expect(hasCommemorativeMarker('Ювілейна монета')).toBe(true);
    expect(hasCommemorativeMarker('30 річчя незалежності')).toBe(true);
  });

  it('is false for a plain circulation file name', () => {
    expect(hasCommemorativeMarker('10 hryvnias 2018 reverse')).toBe(false);
    expect(hasCommemorativeMarker('')).toBe(false);
  });
});

describe('detectSide', () => {
  it('finds the reverse in all its spellings', () => {
    for (const text of ['coin reverse', 'coin REV', 'coin revers', 'монета реверс']) {
      expect(detectSide(text)).toBe('reverse');
    }
  });

  it('finds the obverse in all its spellings', () => {
    for (const text of ['coin obverse', 'coin obv', 'coin avers', 'монета аверс']) {
      expect(detectSide(text)).toBe('obverse');
    }
  });

  it('is both when both are named, unknown when neither is', () => {
    expect(detectSide('coin obverse and reverse')).toBe('both');
    expect(detectSide('10 hryvnias 2018')).toBe('unknown');
  });
});

describe('fileText', () => {
  it('holds the title without prefix and extension and the parent category names', () => {
    const text = fileText(file('File:10 hryvnias 2018 Sich reverse.jpg', ['Category:Hryvnia coins of Ukraine']));

    expect(text).toContain('10 hryvnias 2018 Sich reverse');
    expect(text).toContain('Hryvnia coins of Ukraine');
    expect(text).not.toContain('File:');
    expect(text).not.toContain('Category:');
    expect(text).not.toContain('.jpg');
  });
});

describe('buildCoinQueries', () => {
  const commemorative: LoadedFixture = {
    file: 'fixtures/ukraine-commemorative-10-hryvnias.json',
    data: parseFixture(
      JSON.stringify({
        country: 'Ukraine',
        denomination: '10 Hryvnias',
        name: 'Ukraine 10 Hryvnias Commemorative',
        coins: [
          { year: 2018, variety: 'Defenders of Donetsk Airport', titleUk: 'Захисникам Донецького аеропорту' },
          { year: 2018, variety: 'Hero of Kyiv', titleUk: 'Герой Києва' },
          { year: 2019, variety: 'Only One' },
        ],
      }),
    ),
  };
  const circulation: LoadedFixture = {
    file: 'fixtures/ukraine-10-hryvnias.json',
    data: parseFixture(
      JSON.stringify({
        country: 'Ukraine',
        denomination: '10 Hryvnias',
        name: 'Ukraine 10 Hryvnias',
        coins: [
          { year: 2018, variety: null, image: null },
          { year: 2018, variety: 'Steel', image: { url: 'https://upload.wikimedia.org/a.jpg', copyrighted: false } },
        ],
      }),
    ),
  };

  const queries = buildCoinQueries([commemorative, circulation]);

  function sorted(values: string[]): string[] {
    return [...values].sort();
  }

  it('makes one query per coin, in file and coin order', () => {
    expect(queries.map((q) => [q.file, q.index])).toEqual([
      ['fixtures/ukraine-commemorative-10-hryvnias.json', 0],
      ['fixtures/ukraine-commemorative-10-hryvnias.json', 1],
      ['fixtures/ukraine-commemorative-10-hryvnias.json', 2],
      ['fixtures/ukraine-10-hryvnias.json', 0],
      ['fixtures/ukraine-10-hryvnias.json', 1],
    ]);
  });

  it('copies country, denomination, year, variety and titleUk', () => {
    expect(queries[0]).toMatchObject({
      country: 'Ukraine',
      denomination: '10 Hryvnias',
      year: 2018,
      variety: 'Defenders of Donetsk Airport',
      titleUk: 'Захисникам Донецького аеропорту',
    });
    expect(queries[2]).toMatchObject({ year: 2019, variety: 'Only One', titleUk: null });
    expect(queries[3]).toMatchObject({ year: 2018, variety: null, titleUk: null });
  });

  it('marks a coin commemorative when the fixture name says so', () => {
    expect(queries.map((q) => q.commemorative)).toEqual([true, true, true, false, false]);
  });

  it('marks a coin with a non-null image object as having an image', () => {
    expect(queries.map((q) => q.hasImage)).toEqual([false, false, false, false, true]);
  });

  it('lists the other coins of the same denomination and year as siblings, across files', () => {
    expect(sorted(queries[0].siblingSubjects)).toEqual(sorted(['Hero of Kyiv', 'Герой Києва', 'Steel']));
    expect(sorted(queries[1].siblingSubjects)).toEqual(
      sorted(['Defenders of Donetsk Airport', 'Захисникам Донецького аеропорту', 'Steel']),
    );
  });

  it('does not count a coin of another year as a sibling', () => {
    expect(queries[2].siblingSubjects).toEqual([]);
    expect(queries[2].sameKindSiblings).toBe(0);
  });

  it('counts same-kind siblings only: commemoratives with commemoratives, circulation with circulation', () => {
    expect(queries[0].sameKindSiblings).toBe(1);
    expect(queries[1].sameKindSiblings).toBe(1);
    // a null variety is a value of its own for the count
    expect(queries[3].sameKindSiblings).toBe(1);
    expect(queries[4].sameKindSiblings).toBe(1);
  });

  it('keeps a lone coin free of siblings', () => {
    const lone = buildCoinQueries([
      {
        file: 'fixtures/ukraine-lone.json',
        data: parseFixture(
          JSON.stringify({ country: 'Ukraine', denomination: '5 Hryvnias', name: 'Ukraine 5 Hryvnias', coins: [{ year: 2019 }] }),
        ),
      },
    ]);

    expect(lone).toHaveLength(1);
    expect(lone[0].siblingSubjects).toEqual([]);
    expect(lone[0].sameKindSiblings).toBe(0);
    expect(lone[0].variety).toBeNull();
  });
});

describe('findTextCandidates', () => {
  const REVERSE = 'File:10 hryvnias 2018 Defenders of Donetsk Airport reverse.jpg';
  const OBVERSE = 'File:10 hryvnias 2018 Defenders of Donetsk Airport obverse.jpg';
  const MARKED = 'File:10 hryvnias 2018 Commemorative Defenders of Donetsk Airport.jpg';

  it('keeps files with the denomination, the year and every subject word, sorted by title', () => {
    const files = [
      file(REVERSE),
      file(OBVERSE),
      file(MARKED),
      file('File:10 hryvnias 2017 Defenders of Donetsk Airport.jpg'),
      file('File:5 hryvnias 2018 Defenders of Donetsk Airport.jpg'),
      file('File:10 hryvnias 2018 Hero of Kyiv.jpg'),
      file('File:10 hryvnias 20180 Defenders of Donetsk Airport.jpg'),
    ];

    const result = findTextCandidates(
      query({ commemorative: true, variety: 'Defenders of Donetsk Airport' }),
      files,
    );

    expect(result).toEqual({ kind: 'candidates', titles: [MARKED, OBVERSE, REVERSE] });
  });

  it('follows the coin: another year selects another file', () => {
    const files = [
      file(REVERSE),
      file('File:10 hryvnias 2017 Defenders of Donetsk Airport.jpg'),
    ];

    const result = findTextCandidates(
      query({ commemorative: true, year: 2017, variety: 'Defenders of Donetsk Airport' }),
      files,
    );

    expect(result).toEqual({ kind: 'candidates', titles: ['File:10 hryvnias 2017 Defenders of Donetsk Airport.jpg'] });
  });

  it('matches a kopiyka denomination and does not mix it with hryvnias', () => {
    const files = [file('File:50 kopiyok 2018 reverse.jpg'), file('File:50 hryvnias 2018 reverse.jpg')];

    const result = findTextCandidates(query({ denomination: '50 Kopiyok' }), files);

    expect(result).toEqual({ kind: 'candidates', titles: ['File:50 kopiyok 2018 reverse.jpg'] });
  });

  it('reads the denomination from a category name', () => {
    const files = [file('File:Reverse 2018.jpg', ['Category:10 hryvnias coins of Ukraine'])];

    expect(findTextCandidates(query(), files)).toEqual({ kind: 'candidates', titles: ['File:Reverse 2018.jpg'] });
  });

  it('accepts the Ukrainian title as the subject', () => {
    const uk = 'File:10 гривень 2018 Захисникам Донецького аеропорту.jpg';

    const result = findTextCandidates(
      query({
        commemorative: true,
        variety: 'Defenders of Donetsk Airport',
        titleUk: 'Захисникам Донецького аеропорту',
      }),
      [file(uk), file('File:10 hryvnias 2018 reverse.jpg')],
    );

    expect(result).toEqual({ kind: 'candidates', titles: [uk] });
  });

  it('drops commemorative files for a circulation coin but keeps them for a commemorative one', () => {
    const plain = 'File:10 hryvnias 2018.jpg';
    const marked = 'File:10 hryvnias 2018 commemorative coin.jpg';

    expect(findTextCandidates(query({ commemorative: false }), [file(plain), file(marked)])).toEqual({
      kind: 'candidates',
      titles: [plain],
    });
    expect(
      findTextCandidates(query({ commemorative: true, variety: 'Anything' }), [file(plain), file('File:10 hryvnias 2018 commemorative Anything.jpg')]),
    ).toEqual({ kind: 'candidates', titles: ['File:10 hryvnias 2018 commemorative Anything.jpg'] });
  });

  it('gives a commemorative coin nothing when no file names its subject', () => {
    const result = findTextCandidates(
      query({ commemorative: true, variety: 'Defenders of Donetsk Airport' }),
      [file('File:10 hryvnias 2018 reverse.jpg')],
    );

    expect(result).toEqual({ kind: 'candidates', titles: [] });
  });

  it('prefers files naming the variety and drops files that name a sibling', () => {
    const steel = 'File:10 hryvnias 2018 Steel reverse.jpg';
    const files = [
      file(steel),
      file('File:10 hryvnias 2018 Cupronickel reverse.jpg'),
      file('File:10 hryvnias 2018 reverse.jpg'),
    ];

    const result = findTextCandidates(
      query({ variety: 'Steel', siblingSubjects: ['Cupronickel'], sameKindSiblings: 1 }),
      files,
    );

    expect(result).toEqual({ kind: 'candidates', titles: [steel] });
  });

  it('is ambiguous when a year has several coin types and the file names none of them', () => {
    const generic = 'File:10 hryvnias 2018 reverse.jpg';

    const result = findTextCandidates(
      query({ variety: 'Steel', siblingSubjects: ['Cupronickel'], sameKindSiblings: 1 }),
      [file('File:10 hryvnias 2018 Cupronickel reverse.jpg'), file(generic)],
    );

    expect(result).toEqual({ kind: 'ambiguous', titles: [generic] });
  });

  it('has no candidates when the only files left belong to a sibling', () => {
    const result = findTextCandidates(
      query({ variety: 'Steel', siblingSubjects: ['Cupronickel'], sameKindSiblings: 1 }),
      [file('File:10 hryvnias 2018 Cupronickel reverse.jpg')],
    );

    expect(result).toEqual({ kind: 'candidates', titles: [] });
  });

  it('accepts a generic file when the circulation coin is the only type of its year', () => {
    const generic = 'File:10 hryvnias 2018 reverse.jpg';

    const result = findTextCandidates(query({ variety: 'Standard', sameKindSiblings: 0 }), [file(generic)]);

    expect(result).toEqual({ kind: 'candidates', titles: [generic] });
  });

  it('has no candidates when no file has the denomination and year', () => {
    expect(findTextCandidates(query(), [file('File:Coin of Ukraine.jpg'), file('File:5 hryvnias 2018.jpg')])).toEqual({
      kind: 'candidates',
      titles: [],
    });
    expect(findTextCandidates(query(), [])).toEqual({ kind: 'candidates', titles: [] });
  });
});

describe('chooseImage', () => {
  const REVERSE = 'File:Coin 2018 reverse.jpg';
  const OBVERSE = 'File:Coin 2018 obverse.jpg';

  it('matches the single eligible file with the image block built from its metadata', () => {
    const reverse = info(REVERSE);

    const outcome = chooseImage([REVERSE], mapOf(reverse));

    expect(outcome).toEqual({
      kind: 'matched',
      title: REVERSE,
      image: {
        url: reverse.url,
        source: 'Ivan',
        license: 'Public domain',
        copyrighted: false,
        attributionRequired: false,
      },
    });
  });

  it('stores the thumbnail URL when there is one', () => {
    const thumb = `${WIKI}thumb/500px-Coin.jpg`;

    const outcome = chooseImage([REVERSE], mapOf(info(REVERSE, PUBLIC_DOMAIN, { thumburl: thumb })));

    expect(outcome).toMatchObject({ kind: 'matched', image: { url: thumb } });
  });

  it('prefers the reverse over the obverse', () => {
    const outcome = chooseImage([OBVERSE, REVERSE], mapOf(info(OBVERSE), info(REVERSE)));

    expect(outcome).toMatchObject({ kind: 'matched', title: REVERSE });
  });

  it('picks the obverse when it is the only eligible file', () => {
    const outcome = chooseImage([OBVERSE], mapOf(info(OBVERSE)));

    expect(outcome).toMatchObject({ kind: 'matched', title: OBVERSE });
  });

  it('is ambiguous when two reverses remain, with the candidates sorted', () => {
    const a = 'File:Coin 2018 reverse a.jpg';
    const b = 'File:Coin 2018 reverse b.jpg';

    expect(chooseImage([b, a], mapOf(info(a), info(b)))).toEqual({ kind: 'ambiguous', candidates: [a, b] });
  });

  it('is ambiguous when there is no reverse and several files remain', () => {
    const plain = 'File:Coin 2018 plain.jpg';

    expect(chooseImage([plain, OBVERSE], mapOf(info(OBVERSE), info(plain)))).toEqual({
      kind: 'ambiguous',
      candidates: [OBVERSE, plain],
    });
  });

  it('ignores a reverse that fails the licence gate when picking the side', () => {
    const outcome = chooseImage([OBVERSE, REVERSE], mapOf(info(OBVERSE), info(REVERSE, CC_BY_SA)));

    expect(outcome).toMatchObject({ kind: 'matched', title: OBVERSE });
  });

  it('rejects a file that fails the licence gate and says so', () => {
    const outcome = chooseImage([REVERSE], mapOf(info(REVERSE, CC_BY_SA)));

    expect(outcome).toEqual({ kind: 'none', reason: 'licence-gate', candidates: [REVERSE] });
  });

  it('accepts attribution not required even when the file is copyrighted', () => {
    const outcome = chooseImage(
      [REVERSE],
      mapOf(info(REVERSE, { Artist: 'Ivan', LicenseShortName: 'CC0', Copyrighted: 'True', AttributionRequired: 'false' })),
    );

    expect(outcome).toMatchObject({ kind: 'matched', title: REVERSE });
  });

  it('rejects a file with no copyright or attribution metadata at all', () => {
    const outcome = chooseImage([REVERSE], mapOf(info(REVERSE, { Artist: 'Ivan' })));

    expect(outcome).toEqual({ kind: 'none', reason: 'licence-gate', candidates: [REVERSE] });
  });

  it('rejects a side-by-side composite as not a single side', () => {
    const outcome = chooseImage([REVERSE], mapOf(info(REVERSE, PUBLIC_DOMAIN, { width: 2000, height: 1000 })));

    expect(outcome).toEqual({ kind: 'none', reason: 'not-single-side', candidates: [REVERSE] });
  });

  it('accepts the aspect limits 1.25 and 0.8 and rejects just outside them', () => {
    const accepted = [
      { width: 1000, height: 800 },
      { width: 800, height: 1000 },
    ];
    for (const size of accepted) {
      expect(chooseImage([REVERSE], mapOf(info(REVERSE, PUBLIC_DOMAIN, size)))).toMatchObject({ kind: 'matched' });
    }
    const rejected = [
      { width: 1000, height: 790 },
      { width: 790, height: 1000 },
    ];
    for (const size of rejected) {
      expect(chooseImage([REVERSE], mapOf(info(REVERSE, PUBLIC_DOMAIN, size)))).toMatchObject({
        kind: 'none',
        reason: 'not-single-side',
      });
    }
  });

  it('reports the licence gate before the shape when different files fail each', () => {
    const wide = 'File:Coin 2018 wide.jpg';

    const outcome = chooseImage(
      [REVERSE, wide],
      mapOf(info(REVERSE, CC_BY_SA), info(wide, PUBLIC_DOMAIN, { width: 2000, height: 1000 })),
    );

    expect(outcome).toMatchObject({ kind: 'none', reason: 'licence-gate' });
  });

  it('still matches the one good file when another candidate fails', () => {
    const outcome = chooseImage([OBVERSE, REVERSE], mapOf(info(OBVERSE, CC_BY_SA), info(REVERSE)));

    expect(outcome).toMatchObject({ kind: 'matched', title: REVERSE });
  });

  it('rejects a URL that is not on upload.wikimedia.org', () => {
    const outcome = chooseImage(
      [REVERSE],
      mapOf(info(REVERSE, PUBLIC_DOMAIN, { url: 'https://example.com/Coin.jpg' })),
    );

    expect(outcome.kind).toBe('none');
  });

  it('treats a title missing from the imageinfo as no candidate', () => {
    const outcome = chooseImage([REVERSE, OBVERSE], mapOf(info(OBVERSE)));

    expect(outcome).toMatchObject({ kind: 'matched', title: OBVERSE });
    expect(chooseImage([REVERSE], new Map())).toEqual({ kind: 'none', reason: 'no-match', candidates: [REVERSE] });
  });

  it('is none / no-match when there are no titles', () => {
    expect(chooseImage([], new Map())).toEqual({ kind: 'none', reason: 'no-match', candidates: [] });
  });
});
