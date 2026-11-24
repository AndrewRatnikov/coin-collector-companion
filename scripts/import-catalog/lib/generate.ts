import { join, resolve } from 'node:path';

import { extractMintageRows } from './mintage-tables';
import type { MintageParseResult, MintageRow, YearRange } from './mintage-tables';
import type { FixtureSource, RawFixtureFile } from './types';

// `pnpm run generate`: fetch one English Wikipedia mintage article through the MediaWiki
// API, save the raw response under sources/, and write a raw fixture for a person to
// review. Every side effect (fetch, clock, file writes, console) comes in through
// GenerateDeps, so this module is testable without the network or the filesystem.

export const GENERATOR_VERSION = '0.1';

const REPO_URL = 'https://github.com/AndrewRatnikov/coin-collector-companion';

// `AppName/version (contact URL or email)`, as docs/catalog-data-licensing.md §1 requires.
// The repo URL is the built-in contact; an extra contact comes from WIKIPEDIA_CONTACT.
export function buildUserAgent(contact?: string): string {
  const extra = contact?.trim();
  return extra
    ? `coin-collector-companion/${GENERATOR_VERSION} (${REPO_URL}; ${extra})`
    : `coin-collector-companion/${GENERATOR_VERSION} (${REPO_URL})`;
}

export const USER_AGENT = buildUserAgent();

export const DENOMINATIONS = ['Cent', 'Nickel', 'Dime', 'Quarter', 'Dollar'] as const;
export type GeneratorDenomination = (typeof DENOMINATIONS)[number];

export const USAGE = [
  'Usage: pnpm run generate -- --article "<English Wikipedia title>" --series "<series name>" --country <country>',
  `         --denomination <${DENOMINATIONS.join('|')}> --years <from>-<to> --out fixtures/<file>.json`,
  '',
  '  --article       title of the English Wikipedia mintage article, e.g. "Washington quarter mintage figures"',
  '  --series        fixture name, e.g. "Washington Quarter"',
  '  --country       country of the coins, e.g. USA',
  `  --denomination  one of ${DENOMINATIONS.join(', ')}`,
  '  --years         inclusive year range, e.g. 1932-1998',
  '  --out           output file ending in .json, relative to scripts/import-catalog',
  '',
  'Set WIKIPEDIA_CONTACT to add a contact (e.g. an email address) to the User-Agent.',
].join('\n');

export const WIKIPEDIA_LICENSE_NOTE =
  'Wikipedia text is CC BY-SA 4.0; the year/mint-mark/variety/mintage facts reproduced here are historical facts, not copyrightable expression -- no attribution obligation for the facts themselves, though the app footer still credits Wikipedia generally';

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export class FetchArticleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchArticleError';
  }
}

export interface GenerateArgs {
  article: string;
  series: string;
  country: string;
  denomination: GeneratorDenomination;
  years: YearRange;
  out: string;
}

const FLAGS = ['--article', '--series', '--country', '--denomination', '--years', '--out'] as const;
type Flag = (typeof FLAGS)[number];

export function parseGenerateArgs(argv: readonly string[]): GenerateArgs {
  const values = new Map<Flag, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') continue;
    if (!token.startsWith('--')) throw new UsageError(`Unexpected argument "${token}"`);

    let name: string;
    let value: string | undefined;
    const eq = token.indexOf('=');
    if (eq >= 0) {
      name = token.slice(0, eq);
      value = token.slice(eq + 1);
    } else {
      name = token;
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        value = next;
        i += 1;
      }
    }
    if (!(FLAGS as readonly string[]).includes(name)) throw new UsageError(`Unknown flag ${name}`);
    const flag = name as Flag;
    if (values.has(flag)) throw new UsageError(`${flag} given more than once`);
    if (value === undefined) throw new UsageError(`${flag} needs a value`);
    values.set(flag, value);
  }

  for (const flag of FLAGS) {
    if (!values.has(flag)) throw new UsageError(`Missing required flag ${flag}`);
    if ((values.get(flag) as string).trim() === '') throw new UsageError(`${flag} must not be empty`);
  }
  const get = (flag: Flag) => (values.get(flag) as string).trim();

  const denomination = get('--denomination');
  if (!(DENOMINATIONS as readonly string[]).includes(denomination)) {
    throw new UsageError(`--denomination must be one of ${DENOMINATIONS.join(', ')} (got "${denomination}")`);
  }

  const yearsText = get('--years');
  const years = /^(\d{4})-(\d{4})$/.exec(yearsText);
  if (!years) throw new UsageError(`--years must look like 1932-1998 (got "${yearsText}")`);
  const from = Number(years[1]);
  const to = Number(years[2]);
  if (from > to) throw new UsageError(`--years: ${from} is after ${to}`);

  const out = get('--out');
  if (!out.endsWith('.json')) throw new UsageError(`--out must end with .json (got "${out}")`);

  return {
    article: get('--article'),
    series: get('--series'),
    country: get('--country'),
    denomination: denomination as GeneratorDenomination,
    years: { from, to },
    out,
  };
}

export function buildParseUrl(title: string): string {
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'wikitext|revid',
    format: 'json',
    formatversion: '2',
    redirects: '1',
  });
  return `https://en.wikipedia.org/w/api.php?${params.toString()}`;
}

export function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function sourcesFileName(article: string, date: string): string {
  const safe = article
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '_');
  return `${safe}.${date}.json`;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  // Read by find-images (lib/commons.ts) for Retry-After; the generator doesn't use it.
  headers?: { get(name: string): string | null };
}

export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<FetchResponseLike>;

export interface FetchedArticle {
  body: string;
  title: string;
  pageId: number;
  revisionId: number;
  wikitext: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Exactly one request, awaited; no retry.
export async function fetchArticle(
  title: string,
  fetchFn: FetchLike,
  userAgent: string = USER_AGENT,
): Promise<FetchedArticle> {
  const url = buildParseUrl(title);
  let response: FetchResponseLike;
  let body: string;
  try {
    response = await fetchFn(url, { headers: { 'User-Agent': userAgent } });
    if (!response.ok) {
      throw new FetchArticleError(
        `MediaWiki API request for "${title}" failed: HTTP ${response.status} ${response.statusText}`.trim(),
      );
    }
    body = await response.text();
  } catch (err) {
    if (err instanceof FetchArticleError) throw err;
    throw new FetchArticleError(`MediaWiki API request for "${title}" failed: ${errorMessage(err)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new FetchArticleError(`MediaWiki API response for "${title}" is not JSON`);
  }

  const data = (json ?? {}) as { error?: { code?: unknown; info?: unknown }; parse?: Record<string, unknown> };
  if (data.error && typeof data.error === 'object') {
    throw new FetchArticleError(
      `MediaWiki API error for "${title}": ${String(data.error.code)}: ${String(data.error.info)}`,
    );
  }
  const parse = data.parse;
  if (!parse || typeof parse.wikitext !== 'string' || typeof parse.revid !== 'number') {
    throw new FetchArticleError(`MediaWiki API response for "${title}" has no wikitext or revision id`);
  }
  return {
    body,
    title: typeof parse.title === 'string' ? parse.title : title,
    pageId: typeof parse.pageid === 'number' ? parse.pageid : 0,
    revisionId: parse.revid,
    wikitext: parse.wikitext,
  };
}

export interface GeneratedCoinEntry {
  year: number;
  mintMark: string | null;
  variety: string | null;
  mintage: number | null;
}

export interface GeneratedFixtureFile extends RawFixtureFile {
  '$schema-note': string;
  sources: FixtureSource[];
  yearRange: [number, number];
  coins: GeneratedCoinEntry[];
}

const SCHEMA_NOTE =
  'Generated by `pnpm run generate` from a Wikipedia mintage article; raw source-shaped fixture, pre-sanitization: mintMark/variety are null where the source has no value, and the import script normalizes them. mintage is null where the source gives no figure. Physical specs, the key-date flag and images are left for a human to fill in.';

const SOURCE_NOTE =
  'Business strikes only: proof, pattern, restrike and bullion rows were skipped. mintage is null where the source gives no figure. Physical specs, the key-date flag and images were not filled in.';

export function buildFixture(
  args: GenerateArgs,
  article: { title: string; revisionId: number },
  fetchedOn: string,
  rawResponsePath: string,
  result: MintageParseResult,
): GeneratedFixtureFile {
  const url = articleUrl(article.title);
  return {
    '$schema-note': SCHEMA_NOTE,
    sources: [
      {
        type: 'year / mint mark / variety / mintage',
        origin: `English Wikipedia "${article.title}" (${url}), revision ${article.revisionId}, fetched ${fetchedOn} through the MediaWiki API (action=parse)`,
        url,
        revisionId: article.revisionId,
        fetchedAt: fetchedOn,
        rawResponse: rawResponsePath,
        license: WIKIPEDIA_LICENSE_NOTE,
        note: SOURCE_NOTE,
      },
    ],
    country: args.country,
    denomination: args.denomination,
    name: args.series,
    yearRange: [args.years.from, args.years.to],
    coins: result.rows.map((r) => ({
      year: r.year,
      mintMark: r.mintMark,
      variety: r.variety,
      mintage: r.mintage,
    })),
  };
}

function describeRow(r: MintageRow): string {
  return `${r.year} ${r.mintMark ?? 'no mark'}${r.variety ? ` [${r.variety}]` : ''}`;
}

export function formatSummary(result: MintageParseResult, outPath: string): string[] {
  const lines: string[] = [];
  lines.push(`Wrote ${result.rows.length} coins to ${outPath}`);

  lines.push('Rows per table:');
  for (const g of result.groups) {
    lines.push(`  ${g.fromYear}–${g.toYear}: ${g.rows} rows (${g.caption || '(no caption)'})`);
  }

  lines.push(`Null mintage: ${result.nullMintage.length}`);
  for (const r of result.nullMintage) lines.push(`  ${describeRow(r)}: "${r.mintageText}"`);

  const fromNotes = result.rows.filter((r) => r.varietySource === 'note');
  lines.push(`Varieties from row notes (check these): ${fromNotes.length}`);
  for (const r of fromNotes) lines.push(`  ${describeRow(r)}`);

  lines.push(`Skipped: ${result.skipped.length}`);
  const reasons: string[] = [];
  for (const s of result.skipped) if (!reasons.includes(s.reason)) reasons.push(s.reason);
  for (const reason of reasons) {
    const rows = result.skipped.filter((s) => s.reason === reason);
    lines.push(`  ${reason}: ${rows.length}`);
    if (reason === 'outside-years') continue;
    for (const s of rows) {
      lines.push(`    ${s.year ?? '?'} ${s.mint || '(no mint)'}${s.note ? `: ${s.note}` : ''} (${s.tableCaption || '(no caption)'})`);
    }
  }

  lines.push(`Duplicate natural keys (set a variety by hand before importing): ${result.duplicateKeys.length}`);
  for (const group of result.duplicateKeys) {
    const mintages = group.map((r) => (r.mintage === null ? `"${r.mintageText}"` : String(r.mintage))).join(', ');
    lines.push(`  ${describeRow(group[0])}: ${group.length} rows (mintages ${mintages})`);
  }

  lines.push(`Tables ignored (no Year/Mint/Mintage columns): ${result.tablesIgnored.length}`);
  for (const caption of result.tablesIgnored) lines.push(`  ${caption}`);

  return lines;
}

export interface GenerateDeps {
  fetch: FetchLike;
  today: () => string;
  baseDir: string;
  contact?: string;
  writeFile: (path: string, contents: string) => void;
  log: (line: string) => void;
  error: (line: string) => void;
}

// 0 ok, 1 fetch or parse failure, 2 usage error.
export async function runGenerate(argv: readonly string[], deps: GenerateDeps): Promise<number> {
  let args: GenerateArgs;
  try {
    args = parseGenerateArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    deps.error(err.message);
    deps.error(USAGE);
    return 2;
  }

  let fetched: FetchedArticle;
  try {
    fetched = await fetchArticle(args.article, deps.fetch, buildUserAgent(deps.contact));
  } catch (err) {
    deps.error(errorMessage(err));
    return 1;
  }

  const date = deps.today();
  const sourcesName = sourcesFileName(args.article, date);
  deps.writeFile(join(deps.baseDir, 'sources', sourcesName), fetched.body);

  const result = extractMintageRows(fetched.wikitext, args.years);
  if (result.rows.length === 0) {
    deps.error(
      `No usable rows found in "${fetched.title}" for ${args.years.from}-${args.years.to}; ${args.out} was not written.`,
    );
    deps.error(`Skipped: ${result.skipped.length}`);
    deps.error(`Tables ignored (no Year/Mint/Mintage columns): ${result.tablesIgnored.length}`);
    for (const caption of result.tablesIgnored) deps.error(`  ${caption}`);
    return 1;
  }

  const fixture = buildFixture(args, fetched, date, `sources/${sourcesName}`, result);
  deps.writeFile(resolve(deps.baseDir, args.out), `${JSON.stringify(fixture, null, 2)}\n`);

  for (const line of formatSummary(result, args.out)) deps.log(line);
  return 0;
}
