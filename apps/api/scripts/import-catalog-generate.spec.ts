import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  FetchArticleError,
  GENERATOR_VERSION,
  USAGE,
  USER_AGENT,
  UsageError,
  WIKIPEDIA_LICENSE_NOTE,
  articleUrl,
  buildFixture,
  buildParseUrl,
  buildUserAgent,
  fetchArticle,
  formatSummary,
  parseGenerateArgs,
  runGenerate,
  sourcesFileName,
} from '../../../scripts/import-catalog/lib/generate';
import type {
  FetchLike,
  FetchResponseLike,
  GenerateArgs,
  GenerateDeps,
} from '../../../scripts/import-catalog/lib/generate';
import { extractMintageRows } from '../../../scripts/import-catalog/lib/mintage-tables';

// CONTRACT_GAPs: none
// No spec here touches the network or the real filesystem: fetch is a jest.fn()
// and writeFile writes to a Map.

function readExcerpt(name: string): string {
  return fs.readFileSync(path.join(__dirname, '__fixtures__/wikipedia', name), 'utf8');
}

const CENT = readExcerpt('united-states-cent-mintage-figures.wikitext');
const QUARTER = readExcerpt('washington-quarter-mintage-figures.wikitext');

const QUARTER_PAGE = { title: 'Washington quarter mintage figures', pageid: 29743901, revid: 1330533271 };
const CENT_PAGE = { title: 'United States cent mintage figures', pageid: 1835871, revid: 1322056496 };

function apiBody(page: { title: string; pageid: number; revid: number }, wikitext: string): string {
  return JSON.stringify({ parse: { title: page.title, pageid: page.pageid, revid: page.revid, redirects: [], wikitext } });
}

function okResponse(body: string): FetchResponseLike {
  return { ok: true, status: 200, statusText: 'OK', text: async () => body };
}

function fetchReturning(body: string): jest.Mock<ReturnType<FetchLike>, Parameters<FetchLike>> {
  return jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () => okResponse(body));
}

const QUARTER_ARGV = [
  '--article',
  'Washington quarter mintage figures',
  '--series',
  'Washington Quarter',
  '--country',
  'USA',
  '--denomination',
  'Quarter',
  '--years',
  '1932-1998',
  '--out',
  'fixtures/us-quarters-washington.json',
];

function argvWith(overrides: Record<string, string>, drop: string[] = []): string[] {
  const map = new Map<string, string>();
  for (let i = 0; i < QUARTER_ARGV.length; i += 2) map.set(QUARTER_ARGV[i], QUARTER_ARGV[i + 1]);
  for (const [k, v] of Object.entries(overrides)) map.set(k, v);
  for (const k of drop) map.delete(k);
  return [...map.entries()].flat();
}

function validArgs(): GenerateArgs {
  return parseGenerateArgs(QUARTER_ARGV);
}

function makeDeps(fetchFn: FetchLike, extra: Partial<GenerateDeps> = {}) {
  const files = new Map<string, string>();
  const logs: string[] = [];
  const errors: string[] = [];
  const deps: GenerateDeps = {
    fetch: fetchFn,
    today: () => '2026-11-21',
    baseDir: '/virtual/import-catalog',
    writeFile: (p, contents) => {
      files.set(p, contents);
    },
    log: (line) => logs.push(line),
    error: (line) => errors.push(line),
    ...extra,
  };
  return { deps, files, logs, errors };
}

describe('parseGenerateArgs', () => {
  it('parses a full command line', () => {
    expect(parseGenerateArgs(QUARTER_ARGV)).toEqual({
      article: 'Washington quarter mintage figures',
      series: 'Washington Quarter',
      country: 'USA',
      denomination: 'Quarter',
      years: { from: 1932, to: 1998 },
      out: 'fixtures/us-quarters-washington.json',
    });
  });

  it('ignores a bare -- token anywhere', () => {
    expect(parseGenerateArgs(['--', ...QUARTER_ARGV])).toEqual(parseGenerateArgs(QUARTER_ARGV));
    expect(parseGenerateArgs([...QUARTER_ARGV.slice(0, 4), '--', ...QUARTER_ARGV.slice(4)])).toEqual(
      parseGenerateArgs(QUARTER_ARGV),
    );
  });

  it('accepts --flag=value', () => {
    const argv = [
      '--article=Washington quarter mintage figures',
      '--series=Washington Quarter',
      '--country=USA',
      '--denomination=Quarter',
      '--years=1932-1998',
      '--out=fixtures/us-quarters-washington.json',
    ];
    expect(parseGenerateArgs(argv)).toEqual(parseGenerateArgs(QUARTER_ARGV));
  });

  it.each(['Cent', 'Nickel', 'Dime', 'Quarter', 'Dollar'])('accepts denomination %s', (d) => {
    expect(parseGenerateArgs(argvWith({ '--denomination': d })).denomination).toBe(d);
  });

  it('reads the years as numbers', () => {
    expect(parseGenerateArgs(argvWith({ '--years': '1909-1958' })).years).toEqual({ from: 1909, to: 1958 });
    expect(parseGenerateArgs(argvWith({ '--years': '1909-1909' })).years).toEqual({ from: 1909, to: 1909 });
  });

  it.each(['--article', '--series', '--country', '--denomination', '--years', '--out'])(
    'throws UsageError naming a missing %s',
    (flag) => {
      const run = () => parseGenerateArgs(argvWith({}, [flag]));
      expect(run).toThrow(UsageError);
      expect(run).toThrow(flag);
    },
  );

  it('rejects a blank required value', () => {
    expect(() => parseGenerateArgs(argvWith({ '--series': '   ' }))).toThrow(UsageError);
  });

  it('rejects a denomination outside the list', () => {
    expect(() => parseGenerateArgs(argvWith({ '--denomination': 'Penny' }))).toThrow(UsageError);
    expect(() => parseGenerateArgs(argvWith({ '--denomination': 'Penny' }))).toThrow('--denomination');
    expect(() => parseGenerateArgs(argvWith({ '--denomination': 'quarter' }))).toThrow(UsageError);
  });

  it('rejects malformed years', () => {
    for (const years of ['1932', '32-98', '1932-', '1932–1998', 'abcd-efgh']) {
      expect(() => parseGenerateArgs(argvWith({ '--years': years }))).toThrow('--years');
    }
  });

  it('rejects years where from is after to', () => {
    expect(() => parseGenerateArgs(argvWith({ '--years': '1998-1932' }))).toThrow(UsageError);
  });

  it('rejects an --out that does not end in .json', () => {
    expect(() => parseGenerateArgs(argvWith({ '--out': 'fixtures/x.txt' }))).toThrow('--out');
  });

  it('rejects an unknown flag, a flag with no value, a repeated flag and a stray argument', () => {
    expect(() => parseGenerateArgs([...QUARTER_ARGV, '--bogus', 'x'])).toThrow(UsageError);
    expect(() => parseGenerateArgs([...QUARTER_ARGV, '--series'])).toThrow(UsageError);
    expect(() => parseGenerateArgs([...QUARTER_ARGV, '--series', 'Other'])).toThrow(UsageError);
    expect(() => parseGenerateArgs([...QUARTER_ARGV, 'stray'])).toThrow(UsageError);
  });
});

describe('USAGE', () => {
  it('starts with Usage: and shows every flag', () => {
    expect(USAGE.startsWith('Usage:')).toBe(true);
    for (const flag of ['--article', '--series', '--country', '--denomination', '--years', '--out']) {
      expect(USAGE).toContain(flag);
    }
  });
});

describe('buildParseUrl', () => {
  it('builds an action=parse wikitext query on English Wikipedia', () => {
    const url = new URL(buildParseUrl('Washington quarter mintage figures'));
    expect(url.origin + url.pathname).toBe('https://en.wikipedia.org/w/api.php');
    expect(url.searchParams.get('action')).toBe('parse');
    expect(url.searchParams.get('page')).toBe('Washington quarter mintage figures');
    expect(url.searchParams.get('prop')).toBe('wikitext|revid');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('formatversion')).toBe('2');
    expect(url.searchParams.get('redirects')).toBe('1');
  });

  it('encodes the title so odd characters survive', () => {
    const url = new URL(buildParseUrl('A & B'));
    expect(url.searchParams.get('page')).toBe('A & B');
    expect(buildParseUrl('A & B')).not.toBe(buildParseUrl('A'));
  });
});

describe('buildUserAgent', () => {
  it('has the AppName/version (contact URL) format with the repo URL', () => {
    expect(GENERATOR_VERSION).toBe('0.1');
    expect(USER_AGENT).toBe(buildUserAgent());
    expect(USER_AGENT).toBe(
      'coin-collector-companion/0.1 (https://github.com/AndrewRatnikov/coin-collector-companion)',
    );
    expect(USER_AGENT).toMatch(/^coin-collector-companion\/[\d.]+ \(https:\/\/github\.com\/[^)]+\)$/);
  });

  it('appends a contact when given', () => {
    const ua = buildUserAgent('maintainer@example.org');
    expect(ua).toBe(
      'coin-collector-companion/0.1 (https://github.com/AndrewRatnikov/coin-collector-companion; maintainer@example.org)',
    );
    expect(ua).not.toBe(USER_AGENT);
  });

  it('ignores a blank contact', () => {
    expect(buildUserAgent('   ')).toBe(USER_AGENT);
    expect(buildUserAgent('')).toBe(USER_AGENT);
  });
});

describe('articleUrl and sourcesFileName', () => {
  it('builds the article URL with underscores', () => {
    expect(articleUrl('Washington quarter mintage figures')).toBe(
      'https://en.wikipedia.org/wiki/Washington_quarter_mintage_figures',
    );
    expect(articleUrl('A & B')).toBe('https://en.wikipedia.org/wiki/A_%26_B');
  });

  it('builds the sources file name', () => {
    expect(sourcesFileName('Washington quarter mintage figures', '2026-11-21')).toBe(
      'Washington_quarter_mintage_figures.2026-11-21.json',
    );
  });

  it('replaces unsafe characters and trims', () => {
    expect(sourcesFileName('  A/B  c:d ', '2026-11-21')).toBe('A_B_c_d.2026-11-21.json');
  });

  it('keeps dots, dashes and underscores, and varies with the date', () => {
    expect(sourcesFileName('x.y-z_w', '2026-01-02')).toBe('x.y-z_w.2026-01-02.json');
    expect(sourcesFileName('x', '2026-01-02')).not.toBe(sourcesFileName('x', '2026-01-03'));
  });
});

describe('fetchArticle', () => {
  it('makes exactly one call with the URL and the User-Agent header, and returns the parsed article', async () => {
    const body = apiBody(QUARTER_PAGE, QUARTER);
    const fetchFn = fetchReturning(body);
    const article = await fetchArticle('Washington quarter mintage figures', fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(buildParseUrl('Washington quarter mintage figures'), {
      headers: { 'User-Agent': USER_AGENT },
    });
    expect(article).toEqual({
      body,
      title: 'Washington quarter mintage figures',
      pageId: 29743901,
      revisionId: 1330533271,
      wikitext: QUARTER,
    });
  });

  it('uses the User-Agent it is given', async () => {
    const fetchFn = fetchReturning(apiBody(CENT_PAGE, CENT));
    const ua = buildUserAgent('maintainer@example.org');
    await fetchArticle('United States cent mintage figures', fetchFn, ua);
    expect(fetchFn.mock.calls[0][1].headers['User-Agent']).toBe(ua);
  });

  it('keeps the response text byte for byte in body', async () => {
    const body = `${apiBody(CENT_PAGE, CENT)}\n  `;
    const article = await fetchArticle('x', fetchReturning(body));
    expect(article.body).toBe(body);
  });

  it('throws FetchArticleError with the status on an HTTP failure', async () => {
    const fetchFn: FetchLike = async () => ({ ok: false, status: 429, statusText: 'Too Many Requests', text: async () => '' });
    await expect(fetchArticle('x', fetchFn)).rejects.toBeInstanceOf(FetchArticleError);
    await expect(fetchArticle('x', fetchFn)).rejects.toThrow('429');
  });

  it('throws FetchArticleError when the body is not JSON', async () => {
    await expect(fetchArticle('x', fetchReturning('<html>nope</html>'))).rejects.toBeInstanceOf(FetchArticleError);
  });

  it('throws FetchArticleError with code and info for an API error', async () => {
    const body = JSON.stringify({ error: { code: 'missingtitle', info: "The page you specified doesn't exist." } });
    const promise = fetchArticle('Nope', fetchReturning(body));
    await expect(promise).rejects.toBeInstanceOf(FetchArticleError);
    await expect(fetchArticle('Nope', fetchReturning(body))).rejects.toThrow('missingtitle');
    await expect(fetchArticle('Nope', fetchReturning(body))).rejects.toThrow("doesn't exist");
  });

  it('throws FetchArticleError when wikitext is not a string or revid is not a number', async () => {
    const noText = JSON.stringify({ parse: { title: 'x', pageid: 1, revid: 2 } });
    const badRevid = JSON.stringify({ parse: { title: 'x', pageid: 1, revid: '2', wikitext: 'w' } });
    await expect(fetchArticle('x', fetchReturning(noText))).rejects.toBeInstanceOf(FetchArticleError);
    await expect(fetchArticle('x', fetchReturning(badRevid))).rejects.toBeInstanceOf(FetchArticleError);
  });

  it('does not retry after a failure', async () => {
    const fetchFn = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => '',
    }));
    await expect(fetchArticle('x', fetchFn)).rejects.toThrow();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('buildFixture', () => {
  const quarterResult = extractMintageRows(QUARTER, { from: 1932, to: 1998 });
  const args = validArgs();
  const fixture = buildFixture(
    args,
    { title: 'Washington quarter mintage figures', revisionId: 1330533271 },
    '2026-11-21',
    'sources/Washington_quarter_mintage_figures.2026-11-21.json',
    quarterResult,
  );

  it('has the keys in the documented order', () => {
    expect(Object.keys(fixture)).toEqual([
      '$schema-note',
      'sources',
      'country',
      'denomination',
      'name',
      'yearRange',
      'coins',
    ]);
  });

  it('copies the arguments into the file header', () => {
    expect(fixture.country).toBe('USA');
    expect(fixture.denomination).toBe('Quarter');
    expect(fixture.name).toBe('Washington Quarter');
    expect(fixture.yearRange).toEqual([1932, 1998]);
  });

  it('fills the sources block', () => {
    expect(fixture.sources).toHaveLength(1);
    const [source] = fixture.sources;
    expect(source.type).toBe('year / mint mark / variety / mintage');
    expect(source.url).toBe('https://en.wikipedia.org/wiki/Washington_quarter_mintage_figures');
    expect(source.revisionId).toBe(1330533271);
    expect(source.fetchedAt).toBe('2026-11-21');
    expect(source.rawResponse).toBe('sources/Washington_quarter_mintage_figures.2026-11-21.json');
    expect(source.license).toBe(WIKIPEDIA_LICENSE_NOTE);
    expect(source.origin).toContain('Washington quarter mintage figures');
    expect(source.origin).toContain('1330533271');
    expect(source.origin).toContain('2026-11-21');
    expect(source.origin).toContain(source.url);
    expect(typeof source.note).toBe('string');
  });

  it('describes the licence', () => {
    expect(WIKIPEDIA_LICENSE_NOTE).toContain('CC BY-SA 4.0');
  });

  it('writes one coin per row with only year, mintMark, variety and mintage', () => {
    expect(fixture.coins).toHaveLength(quarterResult.rows.length);
    for (const coin of fixture.coins) {
      expect(Object.keys(coin)).toEqual(['year', 'mintMark', 'variety', 'mintage']);
    }
    expect(fixture.coins[0]).toEqual({ year: 1932, mintMark: null, variety: null, mintage: 5404000 });
    expect(fixture.coins[1]).toEqual({ year: 1932, mintMark: 'D', variety: null, mintage: 436800 });
  });

  it('has no specs, isKeyDate or image anywhere', () => {
    const text = JSON.stringify(fixture);
    expect(fixture).not.toHaveProperty('specs');
    expect(text).not.toContain('isKeyDate');
    expect(text).not.toContain('"image');
    expect(text).not.toContain('"specs"');
  });

  it('keeps null mintage as null', () => {
    const nulls = fixture.coins.filter((c) => c.mintage === null);
    expect(nulls).toHaveLength(quarterResult.nullMintage.length);
    expect(nulls.length).toBeGreaterThan(0);
  });

  it('changes with different arguments and results', () => {
    const centResult = extractMintageRows(CENT, { from: 1793, to: 1865 });
    const other = buildFixture(
      { ...args, series: 'Large Cent', denomination: 'Cent', years: { from: 1793, to: 1865 } },
      { title: 'United States cent mintage figures', revisionId: 1322056496 },
      '2026-11-22',
      'sources/United_States_cent_mintage_figures.2026-11-22.json',
      centResult,
    );
    expect(other.name).toBe('Large Cent');
    expect(other.denomination).toBe('Cent');
    expect(other.yearRange).toEqual([1793, 1865]);
    expect(other.coins).toHaveLength(17);
    expect(other.sources[0].revisionId).toBe(1322056496);
    expect(other.sources[0].fetchedAt).toBe('2026-11-22');
  });
});

describe('formatSummary', () => {
  const centResult = extractMintageRows(CENT, { from: 1793, to: 1865 });
  const lines = formatSummary(centResult, 'fixtures/us-cents.json');

  it('has the exact heading lines with their counts', () => {
    expect(lines).toContain('Wrote 17 coins to fixtures/us-cents.json');
    expect(lines).toContain('Rows per table:');
    expect(lines).toContain('Null mintage: 2');
    expect(lines).toContain('Varieties from row notes (check these): 6');
    expect(lines).toContain('Skipped: 9');
    expect(lines).toContain('  proof: 9');
    expect(lines).toContain('Duplicate natural keys (set a variety by hand before importing): 1');
    expect(lines).toContain('Tables ignored (no Year/Mint/Mintage columns): 0');
  });

  it('lists one line per table group with the year range and row count', () => {
    const joined = lines.join('\n');
    expect(joined).toContain('1793–1796: 6 rows (Liberty Cap large cent');
    expect(joined).toContain('1860–1864: 5 rows');
  });

  it('lists each null mintage with its cell text in quotes', () => {
    const joined = lines.join('\n');
    expect(joined).toContain('"c9"');
    expect(joined).toContain('"^"');
  });

  it('reports different counts for a different result', () => {
    const quarterResult = extractMintageRows(QUARTER, { from: 1965, to: 1977 });
    const q = formatSummary(quarterResult, 'out.json');
    expect(q).toContain('Wrote 8 coins to out.json');
    expect(q).toContain('Null mintage: 1');
    expect(q).toContain('  outside-years: 20');
    expect(q).toContain('  pattern: 1');
    expect(q).toContain('  included-above: 2');
    expect(q).toContain('Duplicate natural keys (set a variety by hand before importing): 0');
  });

  it('shows the ignored table captions', () => {
    const result = extractMintageRows('{|\n|+Wide table\n|-\n! Year !! State\n|-\n| 1999 || X\n|}', {
      from: 1900,
      to: 2100,
    });
    const out = formatSummary(result, 'o.json');
    expect(out).toContain('Tables ignored (no Year/Mint/Mintage columns): 1');
    expect(out.join('\n')).toContain('Wide table');
  });
});

describe('runGenerate', () => {
  const sourcesPath = '/virtual/import-catalog/sources/Washington_quarter_mintage_figures.2026-11-21.json';
  const outPath = '/virtual/import-catalog/fixtures/us-quarters-washington.json';

  it('fetches once, saves the raw response verbatim, writes the fixture and prints the summary', async () => {
    const body = apiBody(QUARTER_PAGE, QUARTER);
    const fetchFn = fetchReturning(body);
    const { deps, files, logs, errors } = makeDeps(fetchFn);
    const code = await runGenerate(QUARTER_ARGV, deps);
    expect(code).toBe(0);
    expect(errors).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(files.get(sourcesPath)).toBe(body);
    expect([...files.keys()].sort()).toEqual([outPath, sourcesPath].sort());

    const written = files.get(outPath) as string;
    expect(written.endsWith('\n')).toBe(true);
    const fixture = JSON.parse(written);
    expect(fixture.name).toBe('Washington Quarter');
    expect(fixture.yearRange).toEqual([1932, 1998]);
    expect(fixture.coins.length).toBeGreaterThan(0);
    expect(fixture.sources[0]).toMatchObject({
      url: 'https://en.wikipedia.org/wiki/Washington_quarter_mintage_figures',
      revisionId: 1330533271,
      fetchedAt: '2026-11-21',
      rawResponse: 'sources/Washington_quarter_mintage_figures.2026-11-21.json',
    });
    expect(written).toBe(JSON.stringify(fixture, null, 2) + '\n');
    expect(logs.some((l) => l.startsWith('Wrote '))).toBe(true);
    expect(logs).toContain('Rows per table:');
  });

  it('filters by the --years range', async () => {
    const { deps, files } = makeDeps(fetchReturning(apiBody(QUARTER_PAGE, QUARTER)));
    await runGenerate(argvWith({ '--years': '1965-1977' }), deps);
    const fixture = JSON.parse(files.get(outPath) as string);
    expect(fixture.coins).toHaveLength(8);
    expect(fixture.yearRange).toEqual([1965, 1977]);
  });

  it('sends the default User-Agent, or the contact when deps.contact is set', async () => {
    const plain = fetchReturning(apiBody(QUARTER_PAGE, QUARTER));
    await runGenerate(QUARTER_ARGV, makeDeps(plain).deps);
    expect(plain.mock.calls[0][1].headers['User-Agent']).toBe(USER_AGENT);

    const withContact = fetchReturning(apiBody(QUARTER_PAGE, QUARTER));
    await runGenerate(QUARTER_ARGV, makeDeps(withContact, { contact: 'maintainer@example.org' }).deps);
    const ua = withContact.mock.calls[0][1].headers['User-Agent'];
    expect(ua).toBe(buildUserAgent('maintainer@example.org'));
    expect(ua).toMatch(/^coin-collector-companion\/[\d.]+ \(https:\/\/github\.com\/[^)]+; maintainer@example\.org\)$/);
  });

  it('is deterministic for the same response, date and arguments', async () => {
    const a = makeDeps(fetchReturning(apiBody(QUARTER_PAGE, QUARTER)));
    const b = makeDeps(fetchReturning(apiBody(QUARTER_PAGE, QUARTER)));
    await runGenerate(QUARTER_ARGV, a.deps);
    await runGenerate(QUARTER_ARGV, b.deps);
    expect(a.files).toEqual(b.files);
    expect(a.logs).toEqual(b.logs);
  });

  it('names the sources file after the article and the date from deps.today', async () => {
    const { deps, files } = makeDeps(fetchReturning(apiBody(CENT_PAGE, CENT)), { today: () => '2027-01-02' });
    const code = await runGenerate(
      argvWith({
        '--article': 'United States cent mintage figures',
        '--denomination': 'Cent',
        '--years': '1793-1865',
        '--out': 'fixtures/cents.json',
      }),
      deps,
    );
    expect(code).toBe(0);
    expect(files.has('/virtual/import-catalog/sources/United_States_cent_mintage_figures.2027-01-02.json')).toBe(true);
    expect(files.has('/virtual/import-catalog/fixtures/cents.json')).toBe(true);
    expect(JSON.parse(files.get('/virtual/import-catalog/fixtures/cents.json') as string).coins).toHaveLength(17);
  });

  it('returns 2 on a usage error without fetching or writing', async () => {
    const fetchFn = fetchReturning('{}');
    const { deps, files, errors } = makeDeps(fetchFn);
    const code = await runGenerate(argvWith({ '--denomination': 'Penny' }), deps);
    expect(code).toBe(2);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(files.size).toBe(0);
    const text = errors.join('\n');
    expect(text).toContain('--denomination');
    expect(text).toContain(USAGE);
  });

  it('returns 2 when arguments are missing', async () => {
    const fetchFn = fetchReturning('{}');
    const { deps } = makeDeps(fetchFn);
    expect(await runGenerate([], deps)).toBe(2);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns 1 and writes nothing when the fetch fails', async () => {
    const fetchFn: FetchLike = async () => ({ ok: false, status: 503, statusText: 'Unavailable', text: async () => '' });
    const { deps, files, errors } = makeDeps(fetchFn);
    const code = await runGenerate(QUARTER_ARGV, deps);
    expect(code).toBe(1);
    expect(files.size).toBe(0);
    expect(errors.join('\n')).toContain('503');
  });

  it('returns 1 and writes nothing when fetch itself rejects', async () => {
    const fetchFn: FetchLike = async () => {
      throw new Error('network down');
    };
    const { deps, files, errors } = makeDeps(fetchFn);
    expect(await runGenerate(QUARTER_ARGV, deps)).toBe(1);
    expect(files.size).toBe(0);
    expect(errors.join('\n')).toContain('network down');
  });

  it('returns 1 and writes nothing for an API error', async () => {
    const body = JSON.stringify({ error: { code: 'missingtitle', info: 'No such page' } });
    const { deps, files, errors } = makeDeps(fetchReturning(body));
    expect(await runGenerate(QUARTER_ARGV, deps)).toBe(1);
    expect(files.size).toBe(0);
    expect(errors.join('\n')).toContain('missingtitle');
  });

  it('with zero usable rows: saves the raw response, leaves --out unwritten, returns 1', async () => {
    // Synthetic: a wide-layout table (no Mint/Mintage columns) like the 50 State quarters article.
    const wide = '{|\n|+Wide layout table\n|-\n! Year !! State !! Philadelphia !! Denver\n|-\n| 1999 || Delaware || 1 || 2\n|}';
    const body = apiBody(QUARTER_PAGE, wide);
    const { deps, files, errors } = makeDeps(fetchReturning(body));
    const code = await runGenerate(QUARTER_ARGV, deps);
    expect(code).toBe(1);
    expect(files.get(sourcesPath)).toBe(body);
    expect(files.has(outPath)).toBe(false);
    expect(errors.join('\n')).toContain('Wide layout table');
  });

  it('with zero rows in the requested years: returns 1 and does not write --out', async () => {
    const { deps, files } = makeDeps(fetchReturning(apiBody(QUARTER_PAGE, QUARTER)));
    const code = await runGenerate(argvWith({ '--years': '1800-1810' }), deps);
    expect(code).toBe(1);
    expect(files.has(outPath)).toBe(false);
  });

  it('resolves --out against baseDir, not the working directory', async () => {
    const { deps, files } = makeDeps(fetchReturning(apiBody(QUARTER_PAGE, QUARTER)), { baseDir: '/elsewhere/pkg' });
    await runGenerate(argvWith({ '--out': 'fixtures/a.json' }), deps);
    expect(files.has('/elsewhere/pkg/fixtures/a.json')).toBe(true);
    expect(files.has('/elsewhere/pkg/sources/Washington_quarter_mintage_figures.2026-11-21.json')).toBe(true);
  });
});
