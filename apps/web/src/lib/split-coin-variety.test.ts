/**
 * Tests for: splitCoinVariety (packages/shared/src/index.ts)
 * Contract source: runs/run_20261119_210926/plan.md § Interface Contract → Function: splitCoinVariety
 * Covers criteria: #1 (from prd.md)
 *
 * packages/shared has no test runner (.claude/rules/monorepo.md), so these tests live in the web app.
 * The web suite reads @coin-collector/shared from dist/, so build shared first.
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import { getCoinName, splitCoinVariety } from '@coin-collector/shared';

describe('splitCoinVariety', () => {
  it('splits "Series: Design" into both parts', () => {
    expect(splitCoinVariety('We Are Strong. We Are Together: Donetsk Oblast')).toEqual({
      series: 'We Are Strong. We Are Together',
      design: 'Donetsk Oblast',
    });
  });

  it('gives a different result for a different input (not a constant)', () => {
    expect(splitCoinVariety('Series A: Design A')).toEqual({ series: 'Series A', design: 'Design A' });
    expect(splitCoinVariety('Series B: Design B')).toEqual({ series: 'Series B', design: 'Design B' });
  });

  it('returns an empty series and the whole variety when there is no ": " separator', () => {
    expect(splitCoinVariety('VDB')).toEqual({ series: '', design: 'VDB' });
    expect(splitCoinVariety('Ratio 1:2')).toEqual({ series: '', design: 'Ratio 1:2' });
  });

  it('returns two empty parts for an empty string', () => {
    expect(splitCoinVariety('')).toEqual({ series: '', design: '' });
  });

  it('uses the non-empty side when the series side is empty', () => {
    expect(splitCoinVariety(': X')).toEqual({ series: '', design: 'X' });
  });

  it('splits only at the first ": "', () => {
    expect(splitCoinVariety('Series: Subject: Detail')).toEqual({ series: 'Series', design: 'Subject: Detail' });
  });
});

describe('getCoinName is unchanged by the export', () => {
  it('still splits the Donetsk Oblast variety into eyebrow and title', () => {
    expect(
      getCoinName({
        country: 'Ukraine',
        denomination: '10 Hryvnias',
        year: 2025,
        mintMark: '',
        variety: 'We Are Strong. We Are Together: Donetsk Oblast',
        name: 'Ukraine Commemorative 10 Hryvnias',
      }),
    ).toEqual({
      eyebrow: 'We Are Strong. We Are Together',
      title: 'Donetsk Oblast',
      subtitle: 'Ukraine · 10 Hryvnias · 2025',
    });
  });
});
