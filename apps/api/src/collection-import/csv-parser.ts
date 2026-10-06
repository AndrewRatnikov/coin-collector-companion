import type { ImportDelimiter, ImportErrorCode } from '@coin-collector/shared';

// Pure CSV decoding and parsing for the collection import. No I/O.

export class CsvImportError extends Error {
  constructor(readonly code: ImportErrorCode) {
    super(code);
    this.name = 'CsvImportError';
  }
}

export interface ParsedCsvRow {
  line: number;
  values: string[];
}

export interface ParsedCsv {
  delimiter: ImportDelimiter;
  headers: string[];
  rows: ParsedCsvRow[];
}

const BOM = '﻿';

export function decodeCsvBuffer(buffer: Uint8Array): string {
  if (buffer.length === 0) {
    throw new CsvImportError('IMPORT_EMPTY');
  }
  if (buffer.includes(0x00)) {
    throw new CsvImportError('IMPORT_NOT_CSV');
  }
  let text: string;
  try {
    // ignoreBOM keeps a leading BOM in the output, so exactly one is stripped below.
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
  } catch {
    throw new CsvImportError('IMPORT_NOT_UTF8');
  }
  return text.startsWith(BOM) ? text.slice(BOM.length) : text;
}

interface RawRecord {
  line: number;
  values: string[];
}

// Splits text into records (RFC 4180 style). Quotes are only special at the start of a field.
function splitRecords(text: string, delimiter: string): RawRecord[] {
  const records: RawRecord[] = [];
  let line = 1;
  let recordLine = 1;
  let field = '';
  let values: string[] = [];
  let inQuotes = false;
  let fieldStarted = false;
  let i = 0;
  const n = text.length;

  const endField = () => {
    values.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRecord = () => {
    endField();
    records.push({ line: recordLine, values });
    values = [];
  };

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && text[i + 1] === '\n') {
          field += '\r\n';
          i += 2;
        } else {
          field += ch;
          i += 1;
        }
        line += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && !fieldStarted && field.trim() === '') {
      // Opening quote (leading whitespace before it is dropped).
      field = '';
      inQuotes = true;
      fieldStarted = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      endField();
      i += 1;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      endRecord();
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      line += 1;
      recordLine = line;
      continue;
    }
    field += ch;
    if (ch !== ' ' && ch !== '\t') fieldStarted = true;
    i += 1;
  }

  // Last record (no trailing newline, or an unterminated quote running to the end).
  if (field !== '' || values.length > 0 || inQuotes) {
    endRecord();
  }
  return records;
}

const BLANK_LINE = /^[\s,;"]*$/;

// The first physical line (newlines inside quotes don't end it) that holds a non-blank record.
function firstNonBlankLine(text: string): string {
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (!inQuotes && (ch === '\r' || ch === '\n')) {
      if (!BLANK_LINE.test(current)) return current;
      current = '';
      continue;
    }
    current += ch;
  }
  return current;
}

function detectDelimiter(text: string): ImportDelimiter {
  const line = firstNonBlankLine(text);
  const counts: Record<ImportDelimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (ch === ',' || ch === ';' || ch === '\t')) {
      counts[ch] += 1;
    }
  }
  let best: ImportDelimiter = ',';
  for (const candidate of [',', ';', '\t'] as const) {
    if (counts[candidate] > counts[best]) best = candidate;
  }
  return best;
}

export function parseCsv(text: string, options: { maxRows?: number } = {}): ParsedCsv {
  const source = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const delimiter = detectDelimiter(source);
  const kept = splitRecords(source, delimiter)
    .map((record) => ({ line: record.line, values: record.values.map((v) => v.trim()) }))
    .filter((record) => record.values.some((v) => v !== ''));

  if (kept.length === 0) {
    throw new CsvImportError('IMPORT_EMPTY');
  }
  const [header, ...rows] = kept;
  if (rows.length === 0) {
    throw new CsvImportError('IMPORT_NO_DATA_ROWS');
  }
  if (options.maxRows !== undefined && rows.length > options.maxRows) {
    throw new CsvImportError('IMPORT_TOO_MANY_ROWS');
  }
  return { delimiter, headers: header.values, rows };
}
