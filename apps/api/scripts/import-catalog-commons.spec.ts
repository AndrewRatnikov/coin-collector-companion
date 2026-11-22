import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  COMMONS_API_URL,
  CommonsApiError,
  IMAGEINFO_BATCH_SIZE,
  MAX_CATEGORY_DEPTH,
  ROOT_CATEGORY,
  THUMB_WIDTH,
  buildCategoryMembersUrl,
  buildImageInfoUrl,
  fetchImageInfo,
  listCategoryFiles,
  parseExtBoolean,
  stripHtml,
  toRawCoinImage,
} from '../../../scripts/import-catalog/lib/commons';
import type { CommonsImageInfo } from '../../../scripts/import-catalog/lib/commons';
import type { FetchLike, FetchResponseLike } from '../../../scripts/import-catalog/lib/generate';

// CONTRACT_GAPs: none
// No spec here touches the network: fetch is a jest.fn() that serves the recorded
// responses under __fixtures__/commons/.

const USER_AGENT = 'coin-collector-companion/0.1 (https://example.org; tester@example.org)';

interface RecordedPage {
  title: string;
  [key: string]: unknown;
}

function readJson(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__/commons', name), 'utf8'));
}

function recordedPages(): RecordedPage[] {
  const parsed = readJson('imageinfo.json') as { pages: RecordedPage[] };
  return parsed.pages;
}

function okResponse(body: string): FetchResponseLike {
  return { ok: true, status: 200, statusText: 'OK', text: async () => body };
}

type FetchMock = jest.Mock<ReturnType<FetchLike>, Parameters<FetchLike>>;

function mockFetch(impl: FetchLike): FetchMock {
  return jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(impl);
}

interface Tracker {
  fetch: FetchMock;
  maxInFlight: () => number;
}

// Serves the recorded category pages and imageinfo pages, and records how many
// requests were in flight at once.
function recordedFetch(): Tracker {
  let inFlight = 0;
  let max = 0;
  const pages = recordedPages();
  const fetchFn: FetchMock = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async (url) => {
    inFlight += 1;
    max = Math.max(max, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 0));
    inFlight -= 1;

    const params = new URL(url).searchParams;
    if (params.get('list') === 'categorymembers') {
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
      const asked = (params.get('titles') ?? '').split('|');
      const served = pages.filter((p) => asked.includes(p.title));
      return okResponse(JSON.stringify({ batchcomplete: true, query: { pages: served } }));
    }
    throw new Error(`unexpected request: ${url}`);
  });
  return { fetch: fetchFn, maxInFlight: () => max };
}

function imageInfoCalls(fetchFn: FetchMock): string[][] {
  return fetchFn.mock.calls
    .map(([url]) => new URL(url).searchParams)
    .filter((p) => p.get('prop') === 'imageinfo')
    .map((p) => (p.get('titles') ?? '').split('|'));
}

const REVERSE_TITLE = 'File:10 hryvnias 2018 Defenders of Donetsk Airport reverse.jpg';
const OBVERSE_TITLE = 'File:10 hryvnias 2018 Defenders of Donetsk Airport obverse.jpg';

describe('constants', () => {
  it('pins the API endpoint, root category and limits', () => {
    expect(COMMONS_API_URL).toBe('https://commons.wikimedia.org/w/api.php');
    expect(ROOT_CATEGORY).toBe('Category:Coins of Ukraine');
    expect(MAX_CATEGORY_DEPTH).toBe(4);
    expect(IMAGEINFO_BATCH_SIZE).toBe(5);
    expect(THUMB_WIDTH).toBe(500);
  });
});

describe('buildCategoryMembersUrl', () => {
  it('asks for subcategories and files, 500 per page, as formatversion 2 JSON', () => {
    const url = new URL(buildCategoryMembersUrl('Category:Coins of Ukraine'));

    expect(`${url.origin}${url.pathname}`).toBe(COMMONS_API_URL);
    expect(url.searchParams.get('action')).toBe('query');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('formatversion')).toBe('2');
    expect(url.searchParams.get('list')).toBe('categorymembers');
    expect(url.searchParams.get('cmtitle')).toBe('Category:Coins of Ukraine');
    expect(url.searchParams.get('cmtype')).toBe('subcat|file');
    expect(url.searchParams.get('cmlimit')).toBe('500');
    expect(url.searchParams.has('cmcontinue')).toBe(false);
  });

  it('carries every key of the previous continue object', () => {
    const url = new URL(
      buildCategoryMembersUrl('Category:Coins of Ukraine', { cmcontinue: 'file|abc|9', continue: '-||' }),
    );

    expect(url.searchParams.get('cmcontinue')).toBe('file|abc|9');
    expect(url.searchParams.get('continue')).toBe('-||');
  });

  it('uses the category it is given', () => {
    const url = new URL(buildCategoryMembersUrl('Category:10 hryvnias coins of Ukraine'));
    expect(url.searchParams.get('cmtitle')).toBe('Category:10 hryvnias coins of Ukraine');
  });
});

describe('buildImageInfoUrl', () => {
  it('requests imageinfo with extmetadata, a 500 px thumbnail and the titles joined by a pipe', () => {
    const url = new URL(buildImageInfoUrl(['File:A.jpg', 'File:B.jpg']));

    expect(`${url.origin}${url.pathname}`).toBe(COMMONS_API_URL);
    expect(url.searchParams.get('action')).toBe('query');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('formatversion')).toBe('2');
    expect(url.searchParams.get('prop')).toBe('imageinfo');
    expect(url.searchParams.get('iiprop')).toBe('url|size|mime|extmetadata');
    expect(url.searchParams.get('iiurlwidth')).toBe('500');
    expect(url.searchParams.get('iiextmetadatafilter')).toBe(
      'Artist|Credit|LicenseShortName|Copyrighted|AttributionRequired',
    );
    expect(url.searchParams.get('titles')).toBe('File:A.jpg|File:B.jpg');
  });

  it('accepts exactly 5 titles', () => {
    const titles = ['File:1.jpg', 'File:2.jpg', 'File:3.jpg', 'File:4.jpg', 'File:5.jpg'];
    expect(new URL(buildImageInfoUrl(titles)).searchParams.get('titles')).toBe(titles.join('|'));
  });

  it('throws a RangeError for no titles and for more than 5', () => {
    expect(() => buildImageInfoUrl([])).toThrow(RangeError);
    expect(() =>
      buildImageInfoUrl(['File:1.jpg', 'File:2.jpg', 'File:3.jpg', 'File:4.jpg', 'File:5.jpg', 'File:6.jpg']),
    ).toThrow(RangeError);
  });
});

describe('listCategoryFiles', () => {
  it('follows continue, descends into subcategories and returns each file once, sorted by title', async () => {
    const { fetch: fetchFn } = recordedFetch();

    const files = await listCategoryFiles(fetchFn, USER_AGENT);

    expect(files).toEqual([
      { title: OBVERSE_TITLE, categories: ['Category:10 hryvnias coins of Ukraine'] },
      { title: REVERSE_TITLE, categories: ['Category:10 hryvnias coins of Ukraine'] },
      { title: 'File:10 hryvnias 2020 Zaporozhian Sich reverse a.jpg', categories: ['Category:10 hryvnias coins of Ukraine'] },
      { title: 'File:10 hryvnias 2020 Zaporozhian Sich reverse b.jpg', categories: ['Category:10 hryvnias coins of Ukraine'] },
      { title: 'File:10 hryvnias 2021 Kyiv Fortress reverse.jpg', categories: ['Category:10 hryvnias coins of Ukraine'] },
      {
        // listed in the root and in the subcategory: both parents, in discovery order
        title: 'File:Ukraine 2018 10 hryvnias reverse.jpg',
        categories: ['Category:Coins of Ukraine', 'Category:10 hryvnias coins of Ukraine'],
      },
      { title: 'File:Ukraine 2019 5 hryvnias reverse.jpg', categories: ['Category:Coins of Ukraine'] },
    ]);
  });

  it('makes three requests in order: root, root continuation, subcategory (the cycle is not revisited)', async () => {
    const { fetch: fetchFn } = recordedFetch();

    await listCategoryFiles(fetchFn, USER_AGENT);

    const requests = fetchFn.mock.calls.map(([url]) => new URL(url).searchParams);
    expect(requests).toHaveLength(3);
    expect(requests[0].get('cmtitle')).toBe('Category:Coins of Ukraine');
    expect(requests[0].has('cmcontinue')).toBe(false);
    expect(requests[1].get('cmtitle')).toBe('Category:Coins of Ukraine');
    expect(requests[1].get('cmcontinue')).toBe('file|5a617068|103');
    expect(requests[1].get('continue')).toBe('-||');
    expect(requests[2].get('cmtitle')).toBe('Category:10 hryvnias coins of Ukraine');
  });

  it('does not descend when maxDepth is 0', async () => {
    const { fetch: fetchFn } = recordedFetch();

    const files = await listCategoryFiles(fetchFn, USER_AGENT, ROOT_CATEGORY, 0);

    expect(files.map((f) => f.title)).toEqual([
      'File:Ukraine 2018 10 hryvnias reverse.jpg',
      'File:Ukraine 2019 5 hryvnias reverse.jpg',
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('descends one level when maxDepth is 1', async () => {
    const { fetch: fetchFn } = recordedFetch();

    const files = await listCategoryFiles(fetchFn, USER_AGENT, ROOT_CATEGORY, 1);

    expect(files).toHaveLength(7);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('sends one request at a time', async () => {
    const tracker = recordedFetch();

    await listCategoryFiles(tracker.fetch, USER_AGENT);

    expect(tracker.maxInFlight()).toBe(1);
  });

  it('sends the User-Agent on every request', async () => {
    const { fetch: fetchFn } = recordedFetch();

    await listCategoryFiles(fetchFn, USER_AGENT);

    expect(fetchFn.mock.calls.length).toBeGreaterThan(0);
    for (const [, init] of fetchFn.mock.calls) {
      expect(init.headers['User-Agent']).toBe(USER_AGENT);
    }
  });

  it('starts from the root it is given', async () => {
    const { fetch: fetchFn } = recordedFetch();

    const files = await listCategoryFiles(fetchFn, USER_AGENT, 'Category:10 hryvnias coins of Ukraine');

    expect(files.map((f) => f.title)).toContain(REVERSE_TITLE);
    expect(new URL(fetchFn.mock.calls[0][0]).searchParams.get('cmtitle')).toBe('Category:10 hryvnias coins of Ukraine');
  });
});

describe('fetchImageInfo', () => {
  it('maps each page to its info keyed by title, with raw extmetadata values', async () => {
    const { fetch: fetchFn } = recordedFetch();

    const infos = await fetchImageInfo([REVERSE_TITLE], fetchFn, USER_AGENT);

    expect([...infos.keys()]).toEqual([REVERSE_TITLE]);
    expect(infos.get(REVERSE_TITLE)).toEqual({
      title: REVERSE_TITLE,
      url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/10_hryvnias_2018_Defenders_of_Donetsk_Airport_reverse.jpg',
      thumburl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/10_hryvnias_2018_Defenders_of_Donetsk_Airport_reverse.jpg/500px-10_hryvnias_2018_Defenders_of_Donetsk_Airport_reverse.jpg',
      width: 2000,
      height: 2000,
      mime: 'image/jpeg',
      extmetadata: {
        Artist: '<a href="//commons.wikimedia.org/wiki/User:Ivan" title="User:Ivan">Ivan &amp; Co</a>',
        Credit: '<span class="int-own-work">Own work</span>',
        LicenseShortName: 'Public domain',
        Copyrighted: 'False',
        AttributionRequired: 'false',
      },
    });
  });

  it('keeps the real size of a composite file', async () => {
    const { fetch: fetchFn } = recordedFetch();
    const title = 'File:10 hryvnias 2018 Defenders of Donetsk Airport obverse and reverse.jpg';

    const infos = await fetchImageInfo([title], fetchFn, USER_AGENT);

    expect(infos.get(title)?.width).toBe(2000);
    expect(infos.get(title)?.height).toBe(1000);
  });

  it('splits seven titles into requests of 5 and 2, one after the other', async () => {
    const tracker = recordedFetch();
    const titles = [
      'File:10 hryvnias 2018 Defenders of Donetsk Airport obverse.jpg',
      'File:10 hryvnias 2018 Defenders of Donetsk Airport reverse.jpg',
      'File:10 hryvnias 2020 Zaporozhian Sich reverse a.jpg',
      'File:10 hryvnias 2020 Zaporozhian Sich reverse b.jpg',
      'File:10 hryvnias 2021 Kyiv Fortress reverse.jpg',
      'File:Ukraine 2018 10 hryvnias reverse.jpg',
      'File:Ukraine 2019 5 hryvnias reverse.jpg',
    ];

    const infos = await fetchImageInfo(titles, tracker.fetch, USER_AGENT);

    expect(imageInfoCalls(tracker.fetch)).toEqual([titles.slice(0, 5), titles.slice(5)]);
    expect(tracker.maxInFlight()).toBe(1);
    expect([...infos.keys()].sort()).toEqual([...titles].sort());
  });

  it('never sends more than 5 titles in one request', async () => {
    const tracker = recordedFetch();
    const titles = recordedPages().map((p) => p.title);
    expect(titles.length).toBeGreaterThan(IMAGEINFO_BATCH_SIZE);

    await fetchImageInfo(titles, tracker.fetch, USER_AGENT);

    for (const batch of imageInfoCalls(tracker.fetch)) {
      expect(batch.length).toBeGreaterThan(0);
      expect(batch.length).toBeLessThanOrEqual(5);
    }
  });

  it('asks for a repeated title once', async () => {
    const { fetch: fetchFn } = recordedFetch();

    const infos = await fetchImageInfo([REVERSE_TITLE, OBVERSE_TITLE, REVERSE_TITLE], fetchFn, USER_AGENT);

    expect(imageInfoCalls(fetchFn)).toEqual([[REVERSE_TITLE, OBVERSE_TITLE]]);
    expect(infos.size).toBe(2);
  });

  it('sends the User-Agent on every request', async () => {
    const { fetch: fetchFn } = recordedFetch();
    const titles = recordedPages().map((p) => p.title);

    await fetchImageInfo(titles, fetchFn, USER_AGENT);

    expect(fetchFn.mock.calls.length).toBeGreaterThan(1);
    for (const [, init] of fetchFn.mock.calls) {
      expect(init.headers['User-Agent']).toBe(USER_AGENT);
    }
  });

  it('sends nothing and returns an empty map for no titles', async () => {
    const { fetch: fetchFn } = recordedFetch();

    const infos = await fetchImageInfo([], fetchFn, USER_AGENT);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(infos.size).toBe(0);
  });

  it('leaves out missing, invalid and info-less pages', async () => {
    const body = JSON.stringify({
      batchcomplete: true,
      query: {
        pages: [
          { ns: 6, title: 'File:Gone.jpg', missing: true },
          { ns: 6, title: 'File:Bad|name.jpg', invalid: true, invalidreason: 'bad title' },
          { pageid: 9, ns: 6, title: 'File:NoInfo.jpg', imagerepository: '' },
          {
            pageid: 10,
            ns: 6,
            title: 'File:Fine.jpg',
            imageinfo: [{ url: 'https://upload.wikimedia.org/x.jpg', width: 10, height: 10, mime: 'image/jpeg', extmetadata: {} }],
          },
        ],
      },
    });
    const fetchFn = mockFetch(async () => okResponse(body));

    const infos = await fetchImageInfo(['File:Gone.jpg', 'File:Bad|name.jpg', 'File:NoInfo.jpg', 'File:Fine.jpg'], fetchFn, USER_AGENT);

    expect([...infos.keys()]).toEqual(['File:Fine.jpg']);
  });

  it('leaves a deleted file out of the recorded response', async () => {
    const { fetch: fetchFn } = recordedFetch();

    const infos = await fetchImageInfo(['File:Gone.jpg', REVERSE_TITLE], fetchFn, USER_AGENT);

    expect(infos.has('File:Gone.jpg')).toBe(false);
    expect(infos.has(REVERSE_TITLE)).toBe(true);
  });
});

describe('Commons API errors', () => {
  it('throws a CommonsApiError naming the HTTP status', async () => {
    const fetchFn = mockFetch(async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => '',
    }));

    await expect(listCategoryFiles(fetchFn, USER_AGENT)).rejects.toBeInstanceOf(CommonsApiError);
    await expect(listCategoryFiles(fetchFn, USER_AGENT)).rejects.toThrow(/503/);
  });

  it('throws a CommonsApiError for a body that is not JSON', async () => {
    const fetchFn = mockFetch(async () => okResponse('<html>rate limited</html>'));

    await expect(fetchImageInfo([REVERSE_TITLE], fetchFn, USER_AGENT)).rejects.toBeInstanceOf(CommonsApiError);
  });

  it('throws a CommonsApiError carrying the API error code and info', async () => {
    const fetchFn = mockFetch(async () =>
      okResponse(JSON.stringify({ error: { code: 'badtitle', info: 'Bad title "x"' } })),
    );

    const failure = fetchImageInfo([REVERSE_TITLE], fetchFn, USER_AGENT);
    await expect(failure).rejects.toBeInstanceOf(CommonsApiError);
    await expect(failure).rejects.toThrow(/badtitle/);
    await expect(failure).rejects.toThrow(/Bad title/);
  });

  it('names the error CommonsApiError and does not retry', async () => {
    const fetchFn = mockFetch(async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => '',
    }));

    const error = await fetchImageInfo([REVERSE_TITLE], fetchFn, USER_AGENT).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('CommonsApiError');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('stops after a failed batch: later batches are not sent', async () => {
    const fetchFn = mockFetch(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => '',
    }));
    const titles = Array.from({ length: 7 }, (_, i) => `File:${i}.jpg`);

    await expect(fetchImageInfo(titles, fetchFn, USER_AGENT)).rejects.toBeInstanceOf(CommonsApiError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('stripHtml', () => {
  it('removes tags and keeps the text', () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:Ivan">Ivan</a>')).toBe('Ivan');
    expect(stripHtml('<span class="int-own-work">Own work</span>')).toBe('Own work');
  });

  it('decodes the named entities', () => {
    expect(stripHtml('Ivan &amp; Co')).toBe('Ivan & Co');
    expect(stripHtml('He said &quot;hi&quot; &#39;x&#39;')).toBe('He said "hi" \'x\'');
  });

  it('decodes &lt; and &gt; as text, not as tags', () => {
    expect(stripHtml('1 &lt; 2 &amp;&amp; 3 &gt; 2')).toBe('1 < 2 && 3 > 2');
  });

  it('decodes numeric entities', () => {
    expect(stripHtml('&#1046;ytomyr')).toBe('Жytomyr');
  });

  it('turns &nbsp; and runs of whitespace into single spaces and trims', () => {
    expect(stripHtml('  <p>Own\n   work</p>\n')).toBe('Own work');
    expect(stripHtml('x&nbsp;&nbsp;y')).toBe('x y');
  });

  it('returns an empty string for markup with no text', () => {
    expect(stripHtml('<a href="x"></a>')).toBe('');
    expect(stripHtml('')).toBe('');
  });
});

describe('parseExtBoolean', () => {
  it('reads true and false in any case', () => {
    expect(parseExtBoolean('True')).toBe(true);
    expect(parseExtBoolean('true')).toBe(true);
    expect(parseExtBoolean('False')).toBe(false);
    expect(parseExtBoolean('false')).toBe(false);
    expect(parseExtBoolean('FALSE')).toBe(false);
  });

  it('is undefined for a missing, empty or other value', () => {
    expect(parseExtBoolean(undefined)).toBeUndefined();
    expect(parseExtBoolean('')).toBeUndefined();
    expect(parseExtBoolean('maybe')).toBeUndefined();
  });
});

describe('toRawCoinImage', () => {
  function info(over: Partial<CommonsImageInfo> = {}): CommonsImageInfo {
    return {
      title: 'File:Coin.jpg',
      url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Coin.jpg',
      thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Coin.jpg/500px-Coin.jpg',
      width: 1000,
      height: 1000,
      mime: 'image/jpeg',
      extmetadata: {
        Artist: '<a href="//commons.wikimedia.org/wiki/User:Ivan">Ivan &amp; Co</a>',
        Credit: '<span>Own work</span>',
        LicenseShortName: 'Public domain',
        Copyrighted: 'False',
        AttributionRequired: 'false',
      },
      ...over,
    };
  }

  it('builds the image block from the thumbnail URL and the stripped Artist, licence and booleans', () => {
    expect(toRawCoinImage(info())).toEqual({
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Coin.jpg/500px-Coin.jpg',
      source: 'Ivan & Co',
      license: 'Public domain',
      copyrighted: false,
      attributionRequired: false,
    });
  });

  it('writes the keys in the order url, source, license, copyrighted, attributionRequired', () => {
    expect(Object.keys(toRawCoinImage(info()))).toEqual(['url', 'source', 'license', 'copyrighted', 'attributionRequired']);
  });

  it('falls back to the original file URL when there is no thumbnail', () => {
    const image = toRawCoinImage(info({ thumburl: undefined }));
    expect(image.url).toBe('https://upload.wikimedia.org/wikipedia/commons/a/a1/Coin.jpg');
  });

  it('uses the Credit when there is no Artist, and when the Artist has no text', () => {
    expect(toRawCoinImage(info({ extmetadata: { Credit: '<span>Own work</span>' } })).source).toBe('Own work');
    expect(toRawCoinImage(info({ extmetadata: { Artist: '<a href="x"></a>', Credit: 'Scan' } })).source).toBe('Scan');
  });

  it('prefers the Artist over the Credit', () => {
    expect(toRawCoinImage(info({ extmetadata: { Artist: 'Ivan', Credit: 'Own work' } })).source).toBe('Ivan');
  });

  it('omits keys with no value instead of writing null', () => {
    const image = toRawCoinImage(info({ extmetadata: {} }));

    expect(image).toEqual({ url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Coin.jpg/500px-Coin.jpg' });
    expect(image).not.toHaveProperty('source');
    expect(image).not.toHaveProperty('license');
    expect(image).not.toHaveProperty('copyrighted');
    expect(image).not.toHaveProperty('attributionRequired');
  });

  it('parses a copyrighted file with required attribution as true / true', () => {
    const image = toRawCoinImage(
      info({
        extmetadata: {
          Artist: 'Olena',
          LicenseShortName: 'CC BY-SA 4.0',
          Copyrighted: 'True',
          AttributionRequired: 'true',
        },
      }),
    );

    expect(image.license).toBe('CC BY-SA 4.0');
    expect(image.copyrighted).toBe(true);
    expect(image.attributionRequired).toBe(true);
  });
});
