// @vitest-environment node
/**
 * Tests for: analytics guards (growth backlog 0.6)
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Guard test (no component)
 * Covers criteria: #1, #2, #3, #7 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Reads files under apps/web/src with fs (no network, no writes). Test files are skipped, so these
 * tests only look at production code.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const srcRoot = path.join(repoRoot, 'apps/web/src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file: string): string {
  return path.relative(repoRoot, file).split(path.sep).join('/');
}

function readJson(relative: string): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } {
  return JSON.parse(readFileSync(path.join(repoRoot, relative), 'utf8'));
}

const files = walk(srcRoot);

describe('analytics guard: only lib/analytics.ts names posthog-js', () => {
  it('finds production files to scan', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.map(rel)).toContain('apps/web/src/lib/analytics.ts');
  });

  it('has exactly one file that mentions the package, and it is lib/analytics.ts', () => {
    const matching = files.filter((f) => /['"]posthog-js['"]/.test(readFileSync(f, 'utf8'))).map(rel);

    expect(matching).toEqual(['apps/web/src/lib/analytics.ts']);
  });
});

describe('analytics guard: nobody identifies a user', () => {
  it('has no identify(, alias( or group( call on any code line', () => {
    const pattern = /(^|[^A-Za-z0-9_])(identify|alias|group)\s*\(/;
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, index) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
          if (pattern.test(line)) offenders.push(`${rel(file)}:${index + 1}: ${trimmed}`);
        });
    }

    expect(offenders).toEqual([]);
  });

  it('analytics.ts never calls the other identity or storage helpers either', () => {
    const text = readFileSync(path.join(srcRoot, 'lib/analytics.ts'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        return !(trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'));
      })
      .join('\n');

    expect(text).not.toMatch(/\.(register|register_once|setPersonProperties|reset)\s*\(/);
    expect(text).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});

describe('analytics guard: instrumentation-client keeps Sentry and starts analytics after it', () => {
  const text = readFileSync(path.join(srcRoot, 'instrumentation-client.ts'), 'utf8');

  it('still has the Sentry setup', () => {
    expect(text).toContain('Sentry.init(');
    expect(text).toContain('replayIntegration');
    expect(text).toContain('onRouterTransitionStart');
  });

  it('calls initAnalytics() after Sentry.init(', () => {
    const sentryAt = text.indexOf('Sentry.init(');
    const analyticsAt = text.indexOf('initAnalytics()');

    expect(sentryAt).toBeGreaterThanOrEqual(0);
    expect(analyticsAt).toBeGreaterThan(sentryAt);
    expect(text).toMatch(/from ['"]@\/lib\/analytics['"]/);
  });
});

describe('analytics guard: dependencies', () => {
  it('pins posthog-js to an exact version in apps/web', () => {
    const version = readJson('apps/web/package.json').dependencies?.['posthog-js'];

    expect(version).toBeDefined();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(['package.json', 'apps/web/package.json', 'apps/api/package.json'])(
    'has no posthog-node in %s',
    (file) => {
      const json = readJson(file);

      expect(Object.keys(json.dependencies ?? {})).not.toContain('posthog-node');
      expect(Object.keys(json.devDependencies ?? {})).not.toContain('posthog-node');
      expect(readFileSync(path.join(repoRoot, file), 'utf8')).not.toContain('posthog-node');
    },
  );

  it('does not add posthog-js to the api or the root', () => {
    expect(Object.keys(readJson('apps/api/package.json').dependencies ?? {})).not.toContain('posthog-js');
    expect(Object.keys(readJson('package.json').dependencies ?? {})).not.toContain('posthog-js');
  });
});
