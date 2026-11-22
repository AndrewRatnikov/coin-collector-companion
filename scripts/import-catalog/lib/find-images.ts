import { resolve } from 'node:path';

import { CommonsApiError, fetchImageInfo, listCategoryFiles } from './commons';
import { FixtureFormatError, setCoinImages } from './fixture-writer';
import { UsageError, buildUserAgent } from './generate';
import type { FetchLike } from './generate';
import { buildCoinQueries, chooseImage, findTextCandidates } from './image-match';
import type { CoinQuery, LoadedFixture, MatchOutcome, TextMatch } from './image-match';
import type { RawCoinImage, RawFixtureFile } from './types';

// `pnpm run find-images`: find a Wikimedia Commons image for each coin of the given
// Ukrainian fixtures and write an `image` block where exactly one file clears the
// matching rules and the licence gate. Every side effect (fetch, file reads/writes,
// console) comes in through FindImagesDeps, so this module is testable offline.

export const FIND_IMAGES_USAGE = [
  'Usage: pnpm run find-images -- fixtures/ukraine-*.json [--dry-run] [--overwrite]',
  '',
  '  <fixture>.json  one or more Ukrainian fixtures, relative to scripts/import-catalog;',
  '                  run them all in one go, so coins of the same year see each other',
  '  --dry-run       print what would be written, write nothing',
  '  --overwrite     also look for coins that already have an image (an image is never removed)',
  '',
  'Set WIKIPEDIA_CONTACT to add a contact (e.g. an email address) to the User-Agent.',
].join('\n');

export interface FindImagesArgs {
  files: string[];
  overwrite: boolean;
  dryRun: boolean;
}

export interface CoinResult {
  query: CoinQuery;
  outcome: MatchOutcome | { kind: 'skipped' };
}

export interface FindImagesDeps {
  fetch: FetchLike;
  baseDir: string;
  contact?: string;
  readFile: (path: string) => string;
  writeFile: (path: string, contents: string) => void;
  log: (line: string) => void;
  error: (line: string) => void;
}

export function parseFindImagesArgs(argv: readonly string[]): FindImagesArgs {
  const args: FindImagesArgs = { files: [], overwrite: false, dryRun: false };
  for (const token of argv) {
    if (token === '--') continue;
    if (token === '--overwrite') args.overwrite = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token.startsWith('--')) throw new UsageError(`Unknown option "${token}"`);
    else if (!token.endsWith('.json')) throw new UsageError(`"${token}" is not a .json fixture`);
    else args.files.push(token);
  }
  if (args.files.length === 0) throw new UsageError('No fixture given');
  return args;
}

export function coinLabel(query: CoinQuery): string {
  const base = `${query.year} ${query.denomination}`;
  return query.variety !== null ? `${base} "${query.variety}"` : base;
}

interface Counts {
  matched: number;
  ambiguous: number;
  none: number;
  skipped: number;
}

function countsOf(results: readonly CoinResult[]): Counts {
  const counts: Counts = { matched: 0, ambiguous: 0, none: 0, skipped: 0 };
  for (const { outcome } of results) counts[outcome.kind] += 1;
  return counts;
}

function formatCounts(c: Counts): string {
  return `matched ${c.matched}, ambiguous ${c.ambiguous}, none ${c.none}, skipped ${c.skipped}`;
}

function section(heading: string, entries: string[]): string[] {
  return [heading, ...(entries.length > 0 ? entries : ['  (none)'])];
}

export function formatFindImagesSummary(
  results: readonly CoinResult[],
  files: readonly string[],
  dryRun: boolean,
): string[] {
  const lines: string[] = [];
  for (const file of files) {
    lines.push(`${file}: ${formatCounts(countsOf(results.filter((r) => r.query.file === file)))}`);
  }
  lines.push(`Total: ${formatCounts(countsOf(results))}`);

  const ambiguous: string[] = [];
  const gate: string[] = [];
  const nothing: string[] = [];
  for (const { query, outcome } of results) {
    const where = `  ${query.file} #${query.index} ${coinLabel(query)}`;
    if (outcome.kind === 'ambiguous') ambiguous.push(`${where}: ${outcome.candidates.join(' | ')}`);
    else if (outcome.kind === 'none' && outcome.reason === 'licence-gate') {
      gate.push(`${where}: ${outcome.candidates.join(' | ')}`);
    } else if (outcome.kind === 'none') nothing.push(`${where} (${outcome.reason})`);
  }

  lines.push(`Of the none, rejected by the licence gate: ${gate.length}`);
  lines.push(...section('Ambiguous (pick by hand):', ambiguous));
  lines.push(...section('Rejected by the licence gate:', gate));
  lines.push(...section('No image found:', nothing));

  if (dryRun) {
    lines.push('Dry run: no file written.');
  } else {
    const written = new Set(results.filter((r) => r.outcome.kind === 'matched').map((r) => r.query.file));
    lines.push(`Wrote image blocks to ${written.size} file(s).`);
  }
  return lines;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface ReadFixture extends LoadedFixture {
  path: string;
  text: string;
}

// 0 ok (ambiguous/none coins are not an error), 1 Commons failure, 2 usage or fixture error.
export async function runFindImages(argv: readonly string[], deps: FindImagesDeps): Promise<number> {
  let args: FindImagesArgs;
  try {
    args = parseFindImagesArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    deps.error(err.message);
    deps.error(FIND_IMAGES_USAGE);
    return 2;
  }

  // Read and check every fixture before any request.
  const fixtures: ReadFixture[] = [];
  for (const file of args.files) {
    const path = resolve(deps.baseDir, file);
    let text: string;
    let data: RawFixtureFile;
    try {
      text = deps.readFile(path);
    } catch (err) {
      deps.error(`${file}: cannot be read: ${errorMessage(err)}`);
      return 2;
    }
    try {
      data = JSON.parse(text) as RawFixtureFile;
    } catch (err) {
      deps.error(`${file}: is not valid JSON: ${errorMessage(err)}`);
      return 2;
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.coins)) {
      deps.error(`${file}: is not a fixture (no "coins" array)`);
      return 2;
    }
    if (data.country !== 'Ukraine') {
      deps.error(`${file}: country is "${String(data.country)}"; find-images only handles Ukrainian fixtures`);
      return 2;
    }
    fixtures.push({ file, data, path, text });
  }

  const queries = buildCoinQueries(fixtures);
  const toProcess = queries.filter((q) => args.overwrite || !q.hasImage);
  const results: CoinResult[] = [];
  const userAgent = buildUserAgent(deps.contact);

  try {
    const outcomes = new Map<CoinQuery, MatchOutcome>();
    if (toProcess.length > 0) {
      const files = await listCategoryFiles(deps.fetch, userAgent);
      const textMatches = new Map<CoinQuery, TextMatch>();
      const titles: string[] = [];
      for (const q of toProcess) {
        const match = findTextCandidates(q, files);
        textMatches.set(q, match);
        if (match.kind === 'candidates') titles.push(...match.titles);
      }
      const infos = titles.length > 0 ? await fetchImageInfo(titles, deps.fetch, userAgent) : new Map();
      for (const q of toProcess) {
        const match = textMatches.get(q) as TextMatch;
        outcomes.set(
          q,
          match.kind === 'ambiguous' ? { kind: 'ambiguous', candidates: match.titles } : chooseImage(match.titles, infos),
        );
      }
    }
    for (const q of queries) {
      results.push({ query: q, outcome: outcomes.get(q) ?? { kind: 'skipped' } });
    }
  } catch (err) {
    if (!(err instanceof CommonsApiError)) throw err;
    deps.error(err.message);
    return 1;
  }

  if (!args.dryRun) {
    // Build every new text first, then write: a fixture error leaves all files untouched.
    const updates: Array<{ path: string; contents: string }> = [];
    try {
      for (const fixture of fixtures) {
        const images = new Map<number, RawCoinImage>();
        for (const { query, outcome } of results) {
          if (query.file === fixture.file && outcome.kind === 'matched') images.set(query.index, outcome.image);
        }
        if (images.size > 0) updates.push({ path: fixture.path, contents: setCoinImages(fixture.text, images) });
      }
    } catch (err) {
      if (!(err instanceof FixtureFormatError)) throw err;
      deps.error(err.message);
      return 2;
    }
    for (const update of updates) deps.writeFile(update.path, update.contents);
  }

  for (const line of formatFindImagesSummary(results, args.files, args.dryRun)) deps.log(line);
  return 0;
}
