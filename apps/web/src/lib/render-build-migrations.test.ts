// @vitest-environment node
/**
 * Tests for: Render deploy applies migrations (growth backlog 0.3)
 * Contract source: runs/run_20261115_193432/plan.md § Interface Contract → Test file: Render build migrations guard
 * Covers criteria: #1, #2, #3 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const GENERATE = 'pnpm --filter api exec prisma generate';
const MIGRATE = 'pnpm --filter api exec prisma migrate deploy';
const SHARED_BUILD = 'pnpm --filter @coin-collector/shared build';
const API_BUILD = 'pnpm --filter api build';

function readRenderYaml(): string {
  return readFileSync(path.join(repoRoot, 'render.yaml'), 'utf8');
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function buildCommandRaw(): string {
  const matches = readRenderYaml()
    .split(/\r?\n/)
    .map((l) => /^\s*buildCommand:\s*(.+)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null);
  expect(matches).toHaveLength(1);
  return stripQuotes(matches[0][1]);
}

function buildSteps(): string[] {
  return buildCommandRaw()
    .split('&&')
    .map((s) => s.trim());
}

describe('render.yaml buildCommand applies migrations', () => {
  it('runs prisma migrate deploy exactly once', () => {
    const steps = buildSteps();
    expect(steps.filter((s) => s === MIGRATE)).toHaveLength(1);
  });

  it('runs migrate deploy immediately after prisma generate', () => {
    const steps = buildSteps();
    const generateIdx = steps.indexOf(GENERATE);
    expect(generateIdx).toBeGreaterThanOrEqual(0);
    expect(steps.indexOf(MIGRATE)).toBe(generateIdx + 1);
  });

  it('runs migrate deploy before the shared and API builds, with the API build last', () => {
    const steps = buildSteps();
    const migrateIdx = steps.indexOf(MIGRATE);
    const sharedIdx = steps.indexOf(SHARED_BUILD);
    const apiIdx = steps.indexOf(API_BUILD);
    expect(migrateIdx).toBeGreaterThanOrEqual(0);
    expect(sharedIdx).toBeGreaterThan(migrateIdx);
    expect(apiIdx).toBeGreaterThan(migrateIdx);
    expect(apiIdx).toBe(steps.length - 1);
  });

  it('chains every step with && only, so a failing step cannot be swallowed', () => {
    const raw = buildCommandRaw();
    expect(raw).not.toContain(';');
    expect(raw).not.toContain('||');
    expect(raw).not.toMatch(/\|\|\s*true/);
    expect(raw).not.toMatch(/(^|[^&])&([^&]|$)/);
  });
});

describe('render.yaml rest of the service is unchanged', () => {
  it('has no preDeployCommand key (free plan)', () => {
    expect(readRenderYaml()).not.toMatch(/preDeployCommand/);
  });

  it('startCommand is node dist/main, so migrations are not run at start', () => {
    const line = readRenderYaml()
      .split(/\r?\n/)
      .find((l) => /^\s*startCommand:/.test(l));
    expect(line).toBeDefined();
    expect(stripQuotes((line ?? '').replace(/^\s*startCommand:\s*/, ''))).toBe('node dist/main');
  });

  it('plan is still free', () => {
    const line = readRenderYaml()
      .split(/\r?\n/)
      .find((l) => /^\s*plan:/.test(l));
    expect(line).toBeDefined();
    expect(stripQuotes((line ?? '').replace(/^\s*plan:\s*/, ''))).toBe('free');
  });

  it('still lists DATABASE_URL as an env var (the build needs it)', () => {
    expect(readRenderYaml()).toMatch(/^\s*-\s*key:\s*DATABASE_URL\s*$/m);
  });
});
