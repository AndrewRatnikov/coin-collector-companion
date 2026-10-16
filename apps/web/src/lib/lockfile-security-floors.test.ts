// @vitest-environment node
/**
 * Tests for: pnpm-lock.yaml security floors (next, postcss, sharp, handlebars, source-map-js)
 * Contract source: runs/run_20261016_225441/plan.md § Interface Contract → Test file: lockfile security floors
 * Covers criteria: #3, #8, #9, #10, #11, #12 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const lockPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../pnpm-lock.yaml');

const FLOORS: Record<string, string> = {
  next: '16.3.8',
  postcss: '8.5.23',
  sharp: '0.35.5',
  handlebars: '4.7.10',
  'source-map-js': '1.2.2',
};

function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const toParts = (v: string): number[] => v.split(/[-+]/)[0].split('.').map((s) => Number(s));
  const pa = toParts(a);
  const pb = toParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function stripPeerSuffix(key: string): string {
  let out = '';
  let depth = 0;
  for (const ch of key) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0) out += ch;
  }
  return out;
}

function parsePackageKeys(lockText: string): Array<{ name: string; version: string }> {
  const lines = lockText.split('\n');
  const result: Array<{ name: string; version: string }> = [];
  let inPackages = false;
  for (const line of lines) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^\S/.test(line)) {
      inPackages = false;
    }
    if (!inPackages) continue;
    const m = /^ {2}(\S.*?):(?: \{\})?\s*$/.exec(line);
    if (!m) continue;
    let key = m[1];
    if (/^(['"]).*\1$/.test(key)) key = key.slice(1, -1);
    key = stripPeerSuffix(key);
    const at = key.lastIndexOf('@');
    if (at <= 0) continue;
    result.push({ name: key.slice(0, at), version: key.slice(at + 1) });
  }
  return result;
}

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('returns 1 when the first is greater', () => {
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
  });

  it('returns -1 when the first is lesser', () => {
    expect(compareVersions('1.2.3', '1.3.0')).toBe(-1);
  });

  it('treats missing segments as 0', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.1', '1.2')).toBe(1);
  });

  it('compares segments numerically, not as strings', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('8.5.23', '8.5.3')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
  });

  it('ignores prerelease and build suffixes', () => {
    expect(compareVersions('1.2.3-beta.1', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3+build5', '1.2.3')).toBe(0);
  });
});

describe('parsePackageKeys', () => {
  const lock = [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '  .:',
    '    dependencies:',
    '      ignored-importer:',
    '        specifier: 1.0.0',
    '',
    'packages:',
    '',
    '  foo@1.2.3:',
    '    resolution: {integrity: sha512-abc}',
    '    dependencies:',
    '      nested-dep: 9.9.9',
    '',
    "  '@img/colour@1.1.0':",
    '    resolution: {integrity: sha512-def}',
    '',
    '  "dq-pkg@2.0.0":',
    '    resolution: {integrity: sha512-ghi}',
    '',
    "  'use-thing@3.0.0(react-dom@19.2.4(react@19.2.4))(react@19.2.4)':",
    '    resolution: {integrity: sha512-jkl}',
    '',
    '  empty-pkg@0.0.1: {}',
    '',
    'snapshots:',
    '',
    '  snap-only@4.0.0:',
    '    dependencies:',
    '      other: 1.0.0',
    '',
  ].join('\n');

  const parsed = parsePackageKeys(lock);

  it('parses an unscoped key', () => {
    expect(parsed).toContainEqual({ name: 'foo', version: '1.2.3' });
  });

  it('parses a scoped quoted key', () => {
    expect(parsed).toContainEqual({ name: '@img/colour', version: '1.1.0' });
  });

  it('parses a double-quoted key', () => {
    expect(parsed).toContainEqual({ name: 'dq-pkg', version: '2.0.0' });
  });

  it('strips nested peer suffixes', () => {
    expect(parsed).toContainEqual({ name: 'use-thing', version: '3.0.0' });
  });

  it('parses keys followed by {}', () => {
    expect(parsed).toContainEqual({ name: 'empty-pkg', version: '0.0.1' });
  });

  it('ignores snapshots-section entries', () => {
    expect(parsed.find((p) => p.name === 'snap-only')).toBeUndefined();
  });

  it('ignores nested dependency lines and importers', () => {
    expect(parsed.find((p) => p.name === 'nested-dep')).toBeUndefined();
    expect(parsed.find((p) => p.name === 'ignored-importer')).toBeUndefined();
    expect(parsed).toHaveLength(5);
  });
});

describe('pnpm-lock.yaml security floors', () => {
  const entries = parsePackageKeys(readFileSync(lockPath, 'utf-8'));

  it('parser finds a non-trivial number of entries including next', () => {
    expect(entries.length).toBeGreaterThan(100);
    expect(entries.some((e) => e.name === 'next')).toBe(true);
  });

  it.each(Object.entries(FLOORS))('every %s version is at or above %s', (name, floor) => {
    const offenders = entries
      .filter((e) => e.name === name && compareVersions(e.version, floor) < 0)
      .map((e) => `${e.name}@${e.version} is below the security floor ${floor}`);
    expect(offenders).toEqual([]);
  });
});
