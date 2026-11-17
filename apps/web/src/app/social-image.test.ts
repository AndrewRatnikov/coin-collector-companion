/**
 * Tests for: social card files (opengraph-image / twitter-image, PNG and alt text)
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Social image
 * Covers criteria: #20 (from prd.md)
 *
 * Reads the committed files next to this test; nothing is fetched.
 *
 * CONTRACT_GAPs: none
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ALT_TEXT = "See what you're still missing. Free checklists for coin collectors.";

describe.each(['opengraph-image', 'twitter-image'])('%s', (name) => {
  it('is a 1200 x 630 PNG', () => {
    const bytes = readFileSync(path.join(here, `${name}.png`));

    expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  });

  it('is a real image, not an empty placeholder', () => {
    const bytes = readFileSync(path.join(here, `${name}.png`));

    expect(bytes.length).toBeGreaterThan(5000);
  });

  it('has alt text with the headline and the sub line', () => {
    const alt = readFileSync(path.join(here, `${name}.alt.txt`), 'utf-8');

    expect(alt.trim()).toBe(ALT_TEXT);
  });
});

describe('the two social images', () => {
  it('are the same picture', () => {
    const og = readFileSync(path.join(here, 'opengraph-image.png'));
    const tw = readFileSync(path.join(here, 'twitter-image.png'));

    expect(og.equals(tw)).toBe(true);
  });
});
