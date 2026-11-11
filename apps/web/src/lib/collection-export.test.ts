/**
 * Tests for: @/lib/collection-export
 * Contract source: runs/run_20261111_204530/plan.md § Interface Contract → Module: collection-export
 * Covers criteria: #4, #5, #6 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionCsvItem } from '@coin-collector/shared';
import { collectionCsvFilename, downloadCollectionCsv } from '@/lib/collection-export';

const HEADER = 'Country,Denomination,Year,Mint mark,Variety,Grade,Series,Key date,Mintage,Owned since';

function item(overrides: Partial<CollectionCsvItem['coin']> = {}, ownedAt: Date = new Date(2026, 0, 2, 12)): CollectionCsvItem {
  return {
    coin: {
      country: 'USA',
      denomination: '1 Cent',
      year: 1909,
      mintMark: '',
      variety: '',
      name: 'Lincoln Wheat Cent',
      isKeyDate: false,
      mintage: null,
      ...overrides,
    },
    grade: null,
    ownedAt,
  };
}

describe('collectionCsvFilename', () => {
  it('builds coin-collection-YYYY-MM-DD.csv from the local date, zero padded', () => {
    expect(collectionCsvFilename(new Date(2026, 0, 5))).toBe('coin-collection-2026-01-05.csv');
    expect(collectionCsvFilename(new Date(2025, 11, 31, 23, 59, 59))).toBe('coin-collection-2025-12-31.csv');
  });
});

describe('downloadCollectionCsv', () => {
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let clicked: { download: string; href: string }[];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    createObjectURL.mockReset();
    revokeObjectURL.mockReset();
    createObjectURL.mockReturnValue('blob:mock-url');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    clicked = [];
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    clickSpy.mockRestore();
    URL.createObjectURL = originalCreate ?? (() => 'blob:noop');
    URL.revokeObjectURL = originalRevoke ?? (() => {});
  });

  function readBytes(blob: Blob): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  it('creates a utf-8 CSV Blob: BOM bytes, header line, one CRLF-separated row per item', async () => {
    downloadCollectionCsv(
      [
        item({ country: 'Ukraine', denomination: '10 Hryvnias', year: 2025, name: 'Señor, "Cent"' }),
        item({ mintMark: 'S', variety: 'VDB', isKeyDate: true, mintage: 484000 }, new Date(2024, 1, 29, 9)),
      ],
      new Date(2026, 9, 1),
    );

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const bytes = await readBytes(blob);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    expect(text.startsWith('﻿' + HEADER)).toBe(true);
    const lines = text.slice(1).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(HEADER);
    // sorted by country: USA before Ukraine (code-unit order)
    expect(lines[1]).toBe('USA,1 Cent,1909,S,VDB,,Lincoln Wheat Cent,yes,484000,2024-02-29');
    expect(lines[2]).toBe('Ukraine,10 Hryvnias,2025,,,,"Señor, ""Cent""",no,,2026-01-02');
  });

  it('writes only the header for an empty list', async () => {
    downloadCollectionCsv([], new Date(2026, 9, 1));

    const bytes = await readBytes(createObjectURL.mock.calls[0][0] as Blob);
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe('﻿' + HEADER);
  });

  it('clicks one anchor whose download is the dated filename and href is the object URL', () => {
    downloadCollectionCsv([item()], new Date(2026, 9, 1));

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('coin-collection-2026-10-01.csv');
    expect(clicked[0].href).toBe('blob:mock-url');
  });

  it('uses the supplied date for the filename', () => {
    downloadCollectionCsv([item()], new Date(2024, 1, 29));

    expect(clicked[0].download).toBe('coin-collection-2024-02-29.csv');
  });

  it('defaults the date to now', () => {
    downloadCollectionCsv([item()]);

    expect(clicked[0].download).toBe(collectionCsvFilename(new Date()));
  });

  it('revokes the object URL only after timers run', () => {
    vi.useFakeTimers();

    downloadCollectionCsv([item()], new Date(2026, 9, 1));

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('removes the anchor from the document after the call', () => {
    const before = document.querySelectorAll('a').length;

    downloadCollectionCsv([item()], new Date(2026, 9, 1));

    expect(document.querySelectorAll('a').length).toBe(before);
  });

  it('propagates errors thrown by createObjectURL', () => {
    createObjectURL.mockImplementation(() => {
      throw new Error('no blob urls');
    });

    expect(() => downloadCollectionCsv([item()], new Date(2026, 9, 1))).toThrow('no blob urls');
    expect(clicked).toHaveLength(0);
  });
});
