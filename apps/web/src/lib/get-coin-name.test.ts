/**
 * Tests for: getCoinName (packages/shared/src/index.ts)
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Function: getCoinName
 * Covers criteria: #4, #5 (from prd.md)
 *
 * packages/shared has no test runner (.claude/rules/monorepo.md), so these unit tests live in the
 * web app and import from '@coin-collector/shared', as the plan's D3 decision says.
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { getCoinName, type CoinNameInput } from '@coin-collector/shared';

function coin(over: Partial<CoinNameInput>): CoinNameInput {
  return {
    country: 'United States',
    denomination: '1 Cent',
    year: 1910,
    mintMark: '',
    variety: '',
    name: 'Lincoln Wheat Cent',
    ...over,
  };
}

describe('getCoinName: Foundations-board examples', () => {
  it('Donetsk Oblast: series is the eyebrow, design the title, subtitle is country, denomination and year', () => {
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

  it('1909-S VDB key date: date-style title, type name as eyebrow, year left out of the subtitle', () => {
    expect(
      getCoinName({
        country: 'United States',
        denomination: '1 Cent',
        year: 1909,
        mintMark: 'S',
        variety: 'VDB',
        name: 'Lincoln Wheat Cent',
        isKeyDate: true,
      }),
    ).toEqual({
      eyebrow: 'Lincoln Wheat Cent',
      title: '1909-S VDB',
      subtitle: 'United States · 1 Cent',
    });
  });

  it('plain 1910 Lincoln Wheat Cent: the type name is the title, no eyebrow, year stays in the subtitle', () => {
    expect(
      getCoinName({
        country: 'United States',
        denomination: '1 Cent',
        year: 1910,
        mintMark: '',
        variety: '',
        name: 'Lincoln Wheat Cent',
      }),
    ).toEqual({
      eyebrow: '',
      title: 'Lincoln Wheat Cent',
      subtitle: 'United States · 1 Cent · 1910',
    });
  });

  it('25 Kopiyok 1992: the name adds nothing to country + denomination, so the title is the denomination', () => {
    expect(
      getCoinName({
        country: 'Ukraine',
        denomination: '25 Kopiyok',
        year: 1992,
        mintMark: '',
        variety: '',
        name: 'Ukraine 25 Kopiyok',
      }),
    ).toEqual({
      eyebrow: '',
      title: '25 Kopiyok',
      subtitle: 'Ukraine · 1992',
    });
  });

  it('a different oblast and year change the title and subtitle (not a constant)', () => {
    const luhansk = getCoinName({
      country: 'Ukraine',
      denomination: '10 Hryvnias',
      year: 2026,
      mintMark: '',
      variety: 'We Are Strong. We Are Together: Luhansk Oblast',
      name: 'Ukraine Commemorative 10 Hryvnias',
    });
    expect(luhansk.title).toBe('Luhansk Oblast');
    expect(luhansk.subtitle).toBe('Ukraine · 10 Hryvnias · 2026');
    expect(luhansk.eyebrow).toBe('We Are Strong. We Are Together');
  });
});

describe('getCoinName: further cases', () => {
  it('an unprefixed, non-key variety is the title and the subtitle keeps all three parts', () => {
    expect(
      getCoinName({
        country: 'Ukraine',
        denomination: '10 Kopiyok',
        year: 2014,
        mintMark: '',
        variety: 'Brass-plated steel',
        name: 'Ukraine 10 Kopiyok',
      }),
    ).toEqual({
      eyebrow: '',
      title: 'Brass-plated steel',
      subtitle: 'Ukraine · 10 Kopiyok · 2014',
    });
  });

  it('a key date with no variety is titled with the collector notation and takes the type name as eyebrow', () => {
    expect(
      getCoinName({
        country: 'USA',
        denomination: 'Cent',
        year: 1914,
        mintMark: 'D',
        variety: '',
        name: 'Lincoln Wheat Cent',
        isKeyDate: true,
      }),
    ).toEqual({
      eyebrow: 'Lincoln Wheat Cent',
      title: '1914-D',
      subtitle: 'USA · Cent',
    });
  });

  it('a key date without a mint mark uses just the year as the date-style title', () => {
    const result = getCoinName(coin({ year: 1955, variety: 'Doubled Die', isKeyDate: true }));
    expect(result.title).toBe('1955 Doubled Die');
  });

  it('a key date whose design already contains the year uses the design alone', () => {
    const result = getCoinName(coin({ year: 1909, mintMark: 'S', variety: 'Special 1909 strike', isKeyDate: true }));
    expect(result.title).toBe('Special 1909 strike');
    expect(result.subtitle).toBe('United States · 1 Cent');
  });

  it('a key date with a series prefix is NOT date-styled: the design stays the title', () => {
    const result = getCoinName(
      coin({
        country: 'Ukraine',
        denomination: '10 Hryvnias',
        year: 2025,
        variety: 'We Are Strong. We Are Together: Kyiv Oblast',
        name: 'Ukraine Commemorative 10 Hryvnias',
        isKeyDate: true,
      }),
    );
    expect(result.title).toBe('Kyiv Oblast');
    expect(result.eyebrow).toBe('We Are Strong. We Are Together');
  });

  it('isKeyDate omitted counts as false: the same coin is date-styled only when the flag is true', () => {
    const base = coin({ country: 'USA', denomination: 'Cent', year: 1914, mintMark: 'D', variety: '' });
    const plain = getCoinName(base);
    const key = getCoinName({ ...base, isKeyDate: true });

    expect(plain.title).toBe('Lincoln Wheat Cent');
    expect(key.title).toBe('1914-D');
    expect(plain).not.toEqual(key);
    expect(getCoinName({ ...base, isKeyDate: false })).toEqual(plain);
  });

  it('a whitespace-only variety counts as none', () => {
    const none = getCoinName(coin({ variety: '' }));
    const blank = getCoinName(coin({ variety: '   ' }));
    expect(blank).toEqual(none);
    expect(blank.title).toBe('Lincoln Wheat Cent');
  });

  it('splits the variety only at the first ": " and keeps later ones in the title', () => {
    const result = getCoinName(coin({ variety: 'Series: Subject: Detail' }));
    expect(result.eyebrow).toBe('Series');
    expect(result.title).toBe('Subject: Detail');
  });

  it('does not split on a colon without a following space', () => {
    const result = getCoinName(coin({ variety: 'Ratio 1:2' }));
    expect(result.title).toBe('Ratio 1:2');
    expect(result.eyebrow).toBe('Lincoln Wheat Cent');
  });

  it('trims every input before using it', () => {
    const result = getCoinName(
      coin({
        country: '  Ukraine ',
        denomination: ' 10 Hryvnias  ',
        variety: '  Series  :   Subject  ',
        name: '  Ukraine Commemorative 10 Hryvnias ',
      }),
    );
    expect(result).toEqual({
      eyebrow: 'Series',
      title: 'Subject',
      subtitle: 'Ukraine · 10 Hryvnias · 1910',
    });
  });

  it('uses the non-empty side when the series side of the separator is empty', () => {
    const result = getCoinName(coin({ variety: ': Foo' }));
    expect(result.title).toBe('Foo');
    expect(result.eyebrow).toBe('Lincoln Wheat Cent');
  });

  it('drops the year from the subtitle when a non-key title already contains it', () => {
    const result = getCoinName({
      country: 'Ukraine',
      denomination: '1 Hryvnia',
      year: 2012,
      mintMark: '',
      variety: 'UEFA Euro 2012 Final Tournament',
      name: 'Ukraine Commemorative 1 Hryvnia',
    });
    expect(result.title).toBe('UEFA Euro 2012 Final Tournament');
    expect(result.subtitle).toBe('Ukraine · 1 Hryvnia');
  });

  it('matches country and denomination case-insensitively when dropping them from the subtitle', () => {
    const result = getCoinName({
      country: 'Ukraine',
      denomination: '2 Hryvnias',
      year: 2020,
      mintMark: '',
      variety: 'KYIV UKRAINE Landmark',
      name: 'Ukraine 2 Hryvnias',
    });
    expect(result.title).toBe('KYIV UKRAINE Landmark');
    expect(result.subtitle).toBe('2 Hryvnias · 2020');
  });

  it('only drops whole words: "Cent" is kept when the title says "Centennial"', () => {
    const result = getCoinName({
      country: 'USA',
      denomination: 'Cent',
      year: 1999,
      mintMark: '',
      variety: 'Centennial Issue',
      name: 'Cent',
    });
    expect(result.title).toBe('Centennial Issue');
    expect(result.subtitle).toBe('USA · Cent · 1999');
  });

  it('a name that is only country + denomination (any case) falls back to the denomination', () => {
    const result = getCoinName(coin({ country: 'USA', denomination: 'Cent', name: 'USA CENT', year: 1990 }));
    expect(result.title).toBe('Cent');
    expect(result.eyebrow).toBe('');
    expect(result.subtitle).toBe('USA · 1990');
  });

  it('a name with extra words beyond country + denomination is the type name', () => {
    const result = getCoinName(
      coin({ country: 'USA', denomination: 'Cent', name: 'Lincoln Wheat Cent', year: 1944, variety: 'Steel' }),
    );
    expect(result.eyebrow).toBe('Lincoln Wheat Cent');
    expect(result.title).toBe('Steel');
  });

  it('a blank country (pending submission) gives a subtitle with no leading separator', () => {
    const result = getCoinName(coin({ country: '', variety: 'Steel', year: 1943, mintMark: 'D' }));
    expect(result.subtitle).toBe('1 Cent · 1943-D');
    expect(result.subtitle.startsWith('·')).toBe(false);
    expect(result.subtitle.startsWith(' ')).toBe(false);
  });

  it('formats the notation with the mint mark only when there is one', () => {
    expect(getCoinName(coin({ variety: 'VDB', year: 1909, mintMark: 'S' })).subtitle).toBe(
      'United States · 1 Cent · 1909-S',
    );
    expect(getCoinName(coin({ variety: 'VDB', year: 1909, mintMark: '' })).subtitle).toBe(
      'United States · 1 Cent · 1909',
    );
  });

  it('never mutates its input', () => {
    const input: CoinNameInput = {
      country: ' USA ',
      denomination: 'Cent',
      year: 1909,
      mintMark: 'S',
      variety: ' Series : VDB ',
      name: 'Lincoln Wheat Cent',
      isKeyDate: true,
    };
    const snapshot = JSON.stringify(input);
    getCoinName(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('is deterministic: the same input gives equal output', () => {
    const input = coin({ variety: 'VDB', year: 1909, mintMark: 'S', isKeyDate: true });
    expect(getCoinName(input)).toEqual(getCoinName({ ...input }));
  });
});
