import * as fs from 'node:fs';
import * as path from 'node:path';

import { MAX_ATTEMPTS, REQUEST_DELAY_MS } from '../../../scripts/import-catalog/lib/commons';
import {
  FIND_IMAGES_USAGE,
  coinLabel,
  formatFindImagesSummary,
  parseFindImagesArgs,
  runFindImages,
} from '../../../scripts/import-catalog/lib/find-images';
import type { CoinResult, FindImagesDeps } from '../../../scripts/import-catalog/lib/find-images';
import type { FetchLike, FetchResponseLike } from '../../../scripts/import-catalog/lib/generate';
import { UsageError, buildUserAgent } from '../../../scripts/import-catalog/lib/generate';
import type { CoinQuery } from '../../../scripts/import-catalog/lib/image-match';

// CONTRACT_GAPs: none
// End to end on recorded Commons responses: a fake fetch serves __fixtures__/commons/*.json,
// readFile/writeFile are backed by a Map, and sleep is a jest.fn() that returns at once.
// No network, no real timers, no filesystem writes.

const BASE_DIR = '/base/scripts/import-catalog';
const CONTACT = 'tester@example.org';

const SAMPLE_FILE = 'fixtures/ukraine-sample.json';
const FIVE_FILE = 'fixtures/ukraine-five.json';

const SAMPLE_TEXT = fs.readFileSync(path.join(__dirname, '__fixtures__/commons/fixture-ukraine-sample.json'), 'utf8');

const FIVE_TEXT = `{
  "country": "Ukraine",
  "denomination": "5 Hryvnias",
  "name": "Ukraine 5 Hryvnias",
  "coins": [
    {
      "year": 2019,
      "variety": null
    }
  ]
}
`;

const USA_TEXT = `{
  "country": "USA",
  "denomination": "Cent",
  "name": "Lincoln Wheat Cent",
  "coins": [
    {
      "year": 1941
    }
  ]
}
`;

const ALL_HAVE_IMAGES_TEXT = `{
  "country": "Ukraine",
  "denomination": "1 Hryvnia",
  "name": "Ukraine 1 Hryvnia",
  "coins": [
    {
      "year": 2018,
      "image": { "url": "https://upload.wikimedia.org/a.jpg", "copyrighted": false }
    }
  ]
}
`;

const THUMB = 'https://upload.wikimedia.org/wikipedia/commons/thumb';
const DEFENDERS_IMAGE = {
  url: `${THUMB}/a/a1/10_hryvnias_2018_Defenders_of_Donetsk_Airport_reverse.jpg/500px-10_hryvnias_2018_Defenders_of_Donetsk_Airport_reverse.jpg`,
  source: 'Ivan & Co',
  license: 'Public domain',
  copyrighted: false,
  attributionRequired: false,
};
const FIVE_IMAGE = {
  url: `${THUMB}/d/d1/Ukraine_2019_5_hryvnias_reverse.jpg/500px-Ukraine_2019_5_hryvnias_reverse.jpg`,
  source: 'Own work',
  license: 'CC0',
  copyrighted: false,
  attributionRequired: false,
};

const ZAP_A = 'File:10 hryvnias 2020 Zaporozhian Sich reverse a.jpg';
const ZAP_B = 'File:10 hryvnias 2020 Zaporozhian Sich reverse b.jpg';
const KYIV = 'File:10 hryvnias 2021 Kyiv Fortress reverse.jpg';

interface RecordedPage {
  title: string;
}

function readJson(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__/commons', name), 'utf8'));
}

function okResponse(body: string): FetchResponseLike {
  return { ok: true, status: 200, statusText: 'OK', text: async () => body };
}

function failResponse(status: number): FetchResponseLike {
  const statusText = status === 429 ? 'Too Many Requests' : 'Failure';
  return { ok: false, status, statusText, text: async () => '', headers: { get: () => null } };
}

interface RecordedOptions {
  // the first N category requests answer 429, then the recorded pages are served
  transient429?: number;
}

type FetchMock = jest.Mock<ReturnType<FetchLike>, Parameters<FetchLike>>;

interface Recorded {
  fetch: FetchMock;
  maxInFlight: () => number;
}

function recordedFetch(
  failOn?: 'categorymembers' | 'imageinfo' | 'categorymembers-429',
  options: RecordedOptions = {},
): Recorded {
  let inFlight = 0;
  let max = 0;
  let categoryCalls = 0;
  const pages = (readJson('imageinfo.json') as { pages: RecordedPage[] }).pages;
  const fetchFn: FetchMock = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async (url) => {
    inFlight += 1;
    max = Math.max(max, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 0));
    inFlight -= 1;

    const params = new URL(url).searchParams;
    if (params.get('list') === 'categorymembers') {
      categoryCalls += 1;
      if (failOn === 'categorymembers') return failResponse(503);
      if (failOn === 'categorymembers-429') return failResponse(429);
      if (categoryCalls <= (options.transient429 ?? 0)) return failResponse(429);
      const title = params.get('cmtitle');
      const cont = params.get('cmcontinue');
      if (title === 'Category:Coins of Ukraine' && cont === null) {
        return okResponse(JSON.stringify(readJson('categorymembers-root.json')));
      }
      if (title === 'Category:Coins of Ukraine' && cont === 'file|5a617068|103') {
        return okResponse(JSON.stringify(readJson('categorymembers-root-continued.json')));
      }
      if (title === 'Category:10 hryvnias coins of Ukraine') {
        return okResponse(JSON.stringify(readJson('categorymembers-subcategory.json')));
      }
      throw new Error(`unexpected category request: ${url}`);
    }
    if (params.get('prop') === 'imageinfo') {
      if (failOn === 'imageinfo') return failResponse(500);
      const asked = (params.get('titles') ?? '').split('|');
      const served = pages.filter((p) => asked.includes(p.title));
      return okResponse(JSON.stringify({ batchcomplete: true, query: { pages: served } }));
    }
    throw new Error(`unexpected request: ${url}`);
  });
  return { fetch: fetchFn, maxInFlight: () => max };
}

interface Harness {
  deps: FindImagesDeps;
  store: Map<string, string>;
  sleep: jest.Mock<Promise<void>, [number]>;
  writeFile: jest.Mock<void, [string, string]>;
  logs: string[];
  errors: string[];
}

function harness(
  files: Record<string, string>,
  fetchFn: FetchLike,
  contact: string | null = CONTACT,
): Harness {
  const store = new Map<string, string>();
  for (const [name, text] of Object.entries(files)) store.set(path.resolve(BASE_DIR, name), text);
  const logs: string[] = [];
  const errors: string[] = [];
  const writeFile = jest.fn<void, [string, string]>((p, contents) => {
    store.set(p, contents);
  });
  const sleep = jest.fn<Promise<void>, [number]>(async () => {});
  const deps: FindImagesDeps = {
    fetch: fetchFn,
    sleep,
    baseDir: BASE_DIR,
    contact: contact ?? undefined,
    readFile: (p) => {
      const text = store.get(p);
      if (text === undefined) throw new Error(`ENOENT: ${p}`);
      return text;
    },
    writeFile,
    log: (line) => logs.push(line),
    error: (line) => errors.push(line),
  };
  return { deps, store, sleep, writeFile, logs, errors };
}

function stored(h: Harness, name: string): string {
  const text = h.store.get(path.resolve(BASE_DIR, name));
  if (text === undefined) throw new Error(`no such file: ${name}`);
  return text;
}

function imageInfoCalls(fetchFn: FetchMock): string[][] {
  return fetchFn.mock.calls
    .map(([url]) => new URL(url).searchParams)
    .filter((p) => p.get('prop') === 'imageinfo')
    .map((p) => (p.get('titles') ?? '').split('|'));
}

function query(over: Partial<CoinQuery> = {}): CoinQuery {
  return {
    file: SAMPLE_FILE,
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

describe('FIND_IMAGES_USAGE', () => {
  it('starts with the command line', () => {
    expect(FIND_IMAGES_USAGE.startsWith('Usage: pnpm run find-images -- ')).toBe(true);
  });
});

describe('parseFindImagesArgs', () => {
  it('takes every path, skipping the -- separator', () => {
    expect(parseFindImagesArgs(['--', 'fixtures/ukraine-a.json', 'fixtures/ukraine-b.json'])).toEqual({
      files: ['fixtures/ukraine-a.json', 'fixtures/ukraine-b.json'],
      overwrite: false,
      dryRun: false,
    });
  });

  it('reads --overwrite and --dry-run in any position', () => {
    expect(parseFindImagesArgs(['fixtures/a.json', '--overwrite', '--dry-run'])).toEqual({
      files: ['fixtures/a.json'],
      overwrite: true,
      dryRun: true,
    });
    expect(parseFindImagesArgs(['--dry-run', 'fixtures/a.json'])).toEqual({
      files: ['fixtures/a.json'],
      overwrite: false,
      dryRun: true,
    });
    expect(parseFindImagesArgs(['--', '--overwrite', 'fixtures/a.json', 'fixtures/b.json'])).toEqual({
      files: ['fixtures/a.json', 'fixtures/b.json'],
      overwrite: true,
      dryRun: false,
    });
  });

  it('throws a UsageError when there is no fixture path', () => {
    expect(() => parseFindImagesArgs([])).toThrow(UsageError);
    expect(() => parseFindImagesArgs(['--'])).toThrow(UsageError);
    expect(() => parseFindImagesArgs(['--dry-run'])).toThrow(UsageError);
  });

  it('throws a UsageError for an unknown flag', () => {
    expect(() => parseFindImagesArgs(['fixtures/a.json', '--bogus'])).toThrow(UsageError);
  });

  it('throws a UsageError for a path that is not a .json file', () => {
    expect(() => parseFindImagesArgs(['fixtures/a.txt'])).toThrow(UsageError);
    expect(() => parseFindImagesArgs(['fixtures/a.json', 'fixtures/README.md'])).toThrow(UsageError);
  });
});

describe('coinLabel', () => {
  it('is year and denomination, with the variety in quotes when there is one', () => {
    expect(coinLabel(query({ year: 2018, denomination: '10 Hryvnias', variety: 'Defenders of Donetsk Airport' }))).toBe(
      '2018 10 Hryvnias "Defenders of Donetsk Airport"',
    );
    expect(coinLabel(query({ year: 2019, denomination: '5 Hryvnias', variety: null }))).toBe('2019 5 Hryvnias');
  });
});

describe('formatFindImagesSummary', () => {
  const matched: CoinResult = {
    query: query({ index: 0, variety: 'A' }),
    outcome: { kind: 'matched', title: 'File:A.jpg', image: { url: 'https://upload.wikimedia.org/a.jpg' } },
  };
  const ambiguous: CoinResult = {
    query: query({ index: 1, year: 2020, variety: 'Zaporozhian Sich' }),
    outcome: { kind: 'ambiguous', candidates: ['File:Z1.jpg', 'File:Z2.jpg'] },
  };
  const gate: CoinResult = {
    query: query({ index: 2, year: 2021, variety: 'Kyiv Fortress' }),
    outcome: { kind: 'none', reason: 'licence-gate', candidates: ['File:K1.jpg', 'File:K2.jpg'] },
  };
  const nothing: CoinResult = {
    query: query({ index: 3, year: 2022, variety: null }),
    outcome: { kind: 'none', reason: 'no-match', candidates: [] },
  };
  const composite: CoinResult = {
    query: query({ index: 4, year: 2023, variety: 'Wide' }),
    outcome: { kind: 'none', reason: 'not-single-side', candidates: ['File:W.jpg'] },
  };
  const skipped: CoinResult = { query: query({ index: 5, year: 2024, variety: 'Old' }), outcome: { kind: 'skipped' } };
  const other: CoinResult = {
    query: query({ file: FIVE_FILE, index: 0, denomination: '5 Hryvnias', year: 2019 }),
    outcome: { kind: 'matched', title: 'File:F.jpg', image: { url: 'https://upload.wikimedia.org/f.jpg' } },
  };

  it('prints the per-file counts, the totals, the gate count and the lists, in order', () => {
    const lines = formatFindImagesSummary(
      [matched, ambiguous, gate, nothing, composite, skipped, other],
      [SAMPLE_FILE, FIVE_FILE],
      false,
    );

    expect(lines).toEqual([
      `${SAMPLE_FILE}: matched 1, ambiguous 1, none 3, skipped 1`,
      `${FIVE_FILE}: matched 1, ambiguous 0, none 0, skipped 0`,
      'Total: matched 2, ambiguous 1, none 3, skipped 1',
      'Of the none, rejected by the licence gate: 1',
      'Ambiguous (pick by hand):',
      `  ${SAMPLE_FILE} #1 2020 10 Hryvnias "Zaporozhian Sich": File:Z1.jpg | File:Z2.jpg`,
      'Rejected by the licence gate:',
      `  ${SAMPLE_FILE} #2 2021 10 Hryvnias "Kyiv Fortress": File:K1.jpg | File:K2.jpg`,
      'No image found:',
      `  ${SAMPLE_FILE} #3 2022 10 Hryvnias (no-match)`,
      `  ${SAMPLE_FILE} #4 2023 10 Hryvnias "Wide" (not-single-side)`,
      'Wrote image blocks to 2 file(s).',
    ]);
  });

  it('says a dry run wrote nothing', () => {
    const lines = formatFindImagesSummary([matched], [SAMPLE_FILE], true);

    expect(lines[lines.length - 1]).toBe('Dry run: no file written.');
    expect(lines.join('\n')).not.toContain('Wrote image blocks');
  });

  it('counts only files with a matched coin as written', () => {
    const lines = formatFindImagesSummary([ambiguous, nothing], [SAMPLE_FILE], false);

    expect(lines[lines.length - 1]).toBe('Wrote image blocks to 0 file(s).');
  });

  it('prints (none) under every empty list', () => {
    expect(formatFindImagesSummary([], [], false)).toEqual([
      'Total: matched 0, ambiguous 0, none 0, skipped 0',
      'Of the none, rejected by the licence gate: 0',
      'Ambiguous (pick by hand):',
      '  (none)',
      'Rejected by the licence gate:',
      '  (none)',
      'No image found:',
      '  (none)',
      'Wrote image blocks to 0 file(s).',
    ]);
  });
});

describe('runFindImages: the sample run', () => {
  const ARGV = ['--', SAMPLE_FILE, FIVE_FILE];

  it('matches, lists the ambiguous and rejected coins, counts, and writes the image blocks', async () => {
    const recorded = recordedFetch();
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recorded.fetch);

    const code = await runFindImages(ARGV, h.deps);

    expect(code).toBe(0);
    expect(h.errors).toEqual([]);
    expect(h.logs).toEqual([
      `${SAMPLE_FILE}: matched 1, ambiguous 1, none 2, skipped 1`,
      `${FIVE_FILE}: matched 1, ambiguous 0, none 0, skipped 0`,
      'Total: matched 2, ambiguous 1, none 2, skipped 1',
      'Of the none, rejected by the licence gate: 1',
      'Ambiguous (pick by hand):',
      `  ${SAMPLE_FILE} #2 2020 10 Hryvnias "Zaporozhian Sich": ${ZAP_A} | ${ZAP_B}`,
      'Rejected by the licence gate:',
      `  ${SAMPLE_FILE} #3 2021 10 Hryvnias "Kyiv Fortress": ${KYIV}`,
      'No image found:',
      `  ${SAMPLE_FILE} #4 2022 10 Hryvnias "Unknown Subject" (no-match)`,
      'Wrote image blocks to 2 file(s).',
    ]);
  });

  it('writes the reverse design of the matched coin, not the obverse and not the generic decoy', async () => {
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recordedFetch().fetch);

    await runFindImages(ARGV, h.deps);

    const sample = JSON.parse(stored(h, SAMPLE_FILE));
    expect(sample.coins[0].image).toEqual(DEFENDERS_IMAGE);
    expect(sample.coins[0].image.url).toContain('reverse');
    expect(sample.coins[0].image.url).not.toContain('Decoy');
    const five = JSON.parse(stored(h, FIVE_FILE));
    expect(five.coins[0].image).toEqual(FIVE_IMAGE);
  });

  it('adds nothing for the ambiguous, rejected and unmatched coins, and leaves the existing image alone', async () => {
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recordedFetch().fetch);

    await runFindImages(ARGV, h.deps);

    const written = JSON.parse(stored(h, SAMPLE_FILE));
    const original = JSON.parse(SAMPLE_TEXT);
    expect(written.coins[1]).toEqual(original.coins[1]);
    expect(written.coins[2]).toEqual(original.coins[2]);
    expect(written.coins[3]).toEqual(original.coins[3]);
    expect(written.coins[4]).toEqual(original.coins[4]);
    expect(written.coins[2].image).toBeUndefined();
    expect(written.coins[3].image).toBeUndefined();
  });

  it('only adds the image block to the fixture text: 4.0 and every other byte survive', async () => {
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recordedFetch().fetch);

    await runFindImages(ARGV, h.deps);

    const written = stored(h, SAMPLE_FILE);
    expect(written).toContain('"weightG": 4.0');
    expect(written).toContain('"weightG": 3.0');
    const inserted = `,\n      "image": ${JSON.stringify(DEFENDERS_IMAGE, null, 2).replace(/\n/g, '\n      ')}`;
    expect(written.replace(inserted, '')).toBe(SAMPLE_TEXT);
  });

  it('writes both files, once each, to the paths it was given', async () => {
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recordedFetch().fetch);

    await runFindImages(ARGV, h.deps);

    expect(h.writeFile).toHaveBeenCalledTimes(2);
    const paths = h.writeFile.mock.calls.map(([p]) => p);
    expect(paths).toEqual([path.resolve(BASE_DIR, SAMPLE_FILE), path.resolve(BASE_DIR, FIVE_FILE)]);
  });

  it('crawls the categories, then asks for imageinfo in batches of 5 then 1, in file and coin order', async () => {
    const recorded = recordedFetch();
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recorded.fetch);

    await runFindImages(ARGV, h.deps);

    expect(recorded.fetch).toHaveBeenCalledTimes(5);
    const kinds = recorded.fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('list') ?? 'imageinfo');
    expect(kinds).toEqual(['categorymembers', 'categorymembers', 'categorymembers', 'imageinfo', 'imageinfo']);
    expect(imageInfoCalls(recorded.fetch)).toEqual([
      [
        'File:10 hryvnias 2018 Defenders of Donetsk Airport obverse.jpg',
        'File:10 hryvnias 2018 Defenders of Donetsk Airport reverse.jpg',
        ZAP_A,
        ZAP_B,
        KYIV,
      ],
      ['File:Ukraine 2019 5 hryvnias reverse.jpg'],
    ]);
  });

  it('does not ask about the generic file that names no subject for a commemorative coin', async () => {
    const recorded = recordedFetch();
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recorded.fetch);

    await runFindImages(ARGV, h.deps);

    const asked = imageInfoCalls(recorded.fetch).flat();
    expect(asked).not.toContain('File:Ukraine 2018 10 hryvnias reverse.jpg');
  });

  it('sends one request at a time, each with the User-Agent built from the contact', async () => {
    const recorded = recordedFetch();
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recorded.fetch);

    await runFindImages(ARGV, h.deps);

    expect(recorded.maxInFlight()).toBe(1);
    expect(recorded.fetch.mock.calls.length).toBeGreaterThan(0);
    for (const [, init] of recorded.fetch.mock.calls) {
      expect(init.headers['User-Agent']).toBe(buildUserAgent(CONTACT));
    }
  });

  it('uses the built-in User-Agent when there is no contact', async () => {
    const recorded = recordedFetch();
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recorded.fetch, null);

    await runFindImages(ARGV, h.deps);

    for (const [, init] of recorded.fetch.mock.calls) {
      expect(init.headers['User-Agent']).toBe(buildUserAgent());
    }
    expect(buildUserAgent()).not.toBe(buildUserAgent(CONTACT));
  });

  it('with --dry-run prints the same counts, requests the same files and writes nothing', async () => {
    const recorded = recordedFetch();
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recorded.fetch);

    const code = await runFindImages([...ARGV, '--dry-run'], h.deps);

    expect(code).toBe(0);
    expect(h.writeFile).not.toHaveBeenCalled();
    expect(stored(h, SAMPLE_FILE)).toBe(SAMPLE_TEXT);
    expect(h.logs).toContain('Total: matched 2, ambiguous 1, none 2, skipped 1');
    expect(h.logs[h.logs.length - 1]).toBe('Dry run: no file written.');
    expect(recorded.fetch).toHaveBeenCalledTimes(5);
  });

  it('skips coins that already have an image, so a second run adds nothing', async () => {
    const first = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recordedFetch().fetch);
    await runFindImages(ARGV, first.deps);

    const second = harness(
      { [SAMPLE_FILE]: stored(first, SAMPLE_FILE), [FIVE_FILE]: stored(first, FIVE_FILE) },
      recordedFetch().fetch,
    );
    const code = await runFindImages(ARGV, second.deps);

    expect(code).toBe(0);
    expect(second.logs).toContain(`${SAMPLE_FILE}: matched 0, ambiguous 1, none 2, skipped 2`);
    expect(second.logs).toContain(`${FIVE_FILE}: matched 0, ambiguous 0, none 0, skipped 1`);
    expect(second.logs).toContain('Total: matched 0, ambiguous 1, none 2, skipped 3');
    expect(second.writeFile).not.toHaveBeenCalled();
  });

  it('with --overwrite processes every coin but never removes an existing image', async () => {
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recordedFetch().fetch);

    const code = await runFindImages([...ARGV, '--overwrite'], h.deps);

    expect(code).toBe(0);
    expect(h.logs).toContain(`${SAMPLE_FILE}: matched 1, ambiguous 1, none 3, skipped 0`);
    const written = JSON.parse(stored(h, SAMPLE_FILE));
    expect(written.coins[1].image).toEqual(JSON.parse(SAMPLE_TEXT).coins[1].image);
    expect(written.coins[0].image).toEqual(DEFENDERS_IMAGE);
  });

  it('pauses REQUEST_DELAY_MS before every request, once per fetch, and nothing else', async () => {
    const recorded = recordedFetch();
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recorded.fetch);

    await runFindImages(ARGV, h.deps);

    expect(recorded.fetch).toHaveBeenCalledTimes(5);
    expect(h.sleep.mock.calls.map(([ms]) => ms)).toEqual([
      REQUEST_DELAY_MS,
      REQUEST_DELAY_MS,
      REQUEST_DELAY_MS,
      REQUEST_DELAY_MS,
      REQUEST_DELAY_MS,
    ]);
  });

  it('makes no request and no pause when every coin already has an image', async () => {
    const recorded = recordedFetch();
    const h = harness({ 'fixtures/ukraine-done.json': ALL_HAVE_IMAGES_TEXT }, recorded.fetch);

    await runFindImages(['fixtures/ukraine-done.json'], h.deps);

    expect(h.sleep).not.toHaveBeenCalled();
  });

  it('makes no request when every coin already has an image', async () => {
    const recorded = recordedFetch();
    const h = harness({ 'fixtures/ukraine-done.json': ALL_HAVE_IMAGES_TEXT }, recorded.fetch);

    const code = await runFindImages(['fixtures/ukraine-done.json'], h.deps);

    expect(code).toBe(0);
    expect(recorded.fetch).not.toHaveBeenCalled();
    expect(h.writeFile).not.toHaveBeenCalled();
    expect(h.logs).toContain('Total: matched 0, ambiguous 0, none 0, skipped 1');
  });
});

describe('runFindImages: usage and fixture errors', () => {
  it('prints the message and the usage and returns 2 when no path is given', async () => {
    const recorded = recordedFetch();
    const h = harness({}, recorded.fetch);

    const code = await runFindImages(['--'], h.deps);

    expect(code).toBe(2);
    expect(h.errors.join('\n')).toContain(FIND_IMAGES_USAGE);
    expect(h.errors.join('\n').length).toBeGreaterThan(FIND_IMAGES_USAGE.length);
    expect(recorded.fetch).not.toHaveBeenCalled();
    expect(h.sleep).not.toHaveBeenCalled();
  });

  it('returns 2 for an unknown flag', async () => {
    const recorded = recordedFetch();
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT }, recorded.fetch);

    expect(await runFindImages([SAMPLE_FILE, '--bogus'], h.deps)).toBe(2);
    expect(recorded.fetch).not.toHaveBeenCalled();
  });

  it('refuses a non-Ukrainian fixture before any request and names the file', async () => {
    const recorded = recordedFetch();
    const h = harness({ 'fixtures/us-cents.json': USA_TEXT }, recorded.fetch);

    const code = await runFindImages(['fixtures/us-cents.json'], h.deps);

    expect(code).toBe(2);
    expect(recorded.fetch).not.toHaveBeenCalled();
    expect(h.sleep).not.toHaveBeenCalled();
    expect(h.writeFile).not.toHaveBeenCalled();
    expect(h.errors.join('\n')).toContain('fixtures/us-cents.json');
  });

  it('refuses the whole run when one of several fixtures is not Ukrainian, writing nothing', async () => {
    const recorded = recordedFetch();
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, 'fixtures/us-cents.json': USA_TEXT }, recorded.fetch);

    const code = await runFindImages([SAMPLE_FILE, 'fixtures/us-cents.json'], h.deps);

    expect(code).toBe(2);
    expect(recorded.fetch).not.toHaveBeenCalled();
    expect(h.writeFile).not.toHaveBeenCalled();
  });

  it('returns 2 for a fixture that cannot be read', async () => {
    const recorded = recordedFetch();
    const h = harness({}, recorded.fetch);

    const code = await runFindImages(['fixtures/missing.json'], h.deps);

    expect(code).toBe(2);
    expect(h.errors.join('\n')).toContain('fixtures/missing.json');
    expect(recorded.fetch).not.toHaveBeenCalled();
  });

  it('returns 2 for a fixture that is not valid JSON', async () => {
    const recorded = recordedFetch();
    const h = harness({ 'fixtures/broken.json': '{ "country": ' }, recorded.fetch);

    const code = await runFindImages(['fixtures/broken.json'], h.deps);

    expect(code).toBe(2);
    expect(h.errors.join('\n')).toContain('fixtures/broken.json');
    expect(recorded.fetch).not.toHaveBeenCalled();
  });
});

describe('runFindImages: Commons failures', () => {
  it('returns 1 with the HTTP status when the category crawl fails, and writes nothing', async () => {
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recordedFetch('categorymembers').fetch);

    const code = await runFindImages([SAMPLE_FILE, FIVE_FILE], h.deps);

    expect(code).toBe(1);
    expect(h.errors.join('\n')).toContain('503');
    expect(h.writeFile).not.toHaveBeenCalled();
  });

  it('recovers from one 429 on the first category request: same files, same summary, one retry line, exit 0', async () => {
    const clean = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recordedFetch().fetch);
    await runFindImages([SAMPLE_FILE, FIVE_FILE], clean.deps);

    const recorded = recordedFetch(undefined, { transient429: 1 });
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recorded.fetch);
    const code = await runFindImages([SAMPLE_FILE, FIVE_FILE], h.deps);

    expect(code).toBe(0);
    expect(h.logs).toEqual(clean.logs);
    expect(stored(h, SAMPLE_FILE)).toBe(stored(clean, SAMPLE_FILE));
    expect(stored(h, FIVE_FILE)).toBe(stored(clean, FIVE_FILE));
    expect(h.errors).toHaveLength(1);
    expect(h.errors[0]).toContain('HTTP 429');
    expect(h.errors[0]).toContain('retrying in');
    expect(recorded.fetch).toHaveBeenCalledTimes(6);
    expect(h.sleep).toHaveBeenCalledTimes(6);
    expect(recorded.maxInFlight()).toBe(1);
  });

  it('returns 1 when every category request answers 429: gave up after 4 attempts, nothing written', async () => {
    const recorded = recordedFetch('categorymembers-429');
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recorded.fetch);

    const code = await runFindImages([SAMPLE_FILE, FIVE_FILE], h.deps);

    expect(code).toBe(1);
    const errors = h.errors.join('\n');
    expect(errors).toContain('429');
    expect(errors).toContain('gave up after 4 attempts');
    expect(h.writeFile).not.toHaveBeenCalled();
    expect(stored(h, SAMPLE_FILE)).toBe(SAMPLE_TEXT);
    expect(recorded.fetch).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(h.logs).toEqual([]);
  });

  it('prints the retry lines of a failed run to errors, one per retry', async () => {
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recordedFetch('categorymembers-429').fetch);

    await runFindImages([SAMPLE_FILE, FIVE_FILE], h.deps);

    const retryLines = h.errors.filter((line) => line.includes('retrying in'));
    expect(retryLines).toHaveLength(MAX_ATTEMPTS - 1);
  });

  it('returns 1 and writes nothing when imageinfo fails after the crawl worked', async () => {
    const recorded = recordedFetch('imageinfo');
    const h = harness({ [SAMPLE_FILE]: SAMPLE_TEXT, [FIVE_FILE]: FIVE_TEXT }, recorded.fetch);

    const code = await runFindImages([SAMPLE_FILE, FIVE_FILE], h.deps);

    expect(code).toBe(1);
    expect(h.errors.join('\n')).toContain('500');
    expect(h.writeFile).not.toHaveBeenCalled();
    expect(stored(h, SAMPLE_FILE)).toBe(SAMPLE_TEXT);
    expect(stored(h, FIVE_FILE)).toBe(FIVE_TEXT);
  });
});
