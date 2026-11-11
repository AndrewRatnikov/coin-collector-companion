import { buildCollectionCsv, formatLocalDate, type CollectionCsvItem } from '@coin-collector/shared';

export function collectionCsvFilename(date: Date): string {
  return `coin-collection-${formatLocalDate(date)}.csv`;
}

/** Builds the whole-collection CSV and downloads it. Errors propagate to the caller. */
export function downloadCollectionCsv(items: readonly CollectionCsvItem[], now: Date = new Date()): void {
  const blob = new Blob([buildCollectionCsv(items)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = collectionCsvFilename(now);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
