// A small reader for MediaWiki table markup ({| … |}) and a text cleaner for cell
// contents. It knows nothing about coins: mintage-tables.ts turns its output into rows.
// No I/O, no dependencies.

export interface WikiTable {
  // Raw caption wikitext after `|+`, trimmed; '' if none.
  caption: string;
  // Raw cells of the first all-`!` row, colspan-expanded; [] if none.
  headers: string[];
  // Raw data cells, rowspan/colspan-expanded, trimmed.
  rows: string[][];
}

interface RawCell {
  content: string;
  header: boolean;
  rowspan: number;
  colspan: number;
}

interface TableBuilder {
  caption: string;
  rows: RawCell[][];
  // The cell that continuation lines are appended to.
  lastCell: RawCell | null;
}

// Splits `text` on any of `separators`, but only outside [[…]] links and {{…}} templates.
function splitTopLevel(text: string, separators: readonly string[]): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('[[', i) || text.startsWith('{{', i)) {
      depth += 1;
      i += 2;
      continue;
    }
    if ((text.startsWith(']]', i) || text.startsWith('}}', i)) && depth > 0) {
      depth -= 1;
      i += 2;
      continue;
    }
    if (depth === 0) {
      const sep = separators.find((s) => text.startsWith(s, i));
      if (sep) {
        parts.push(text.slice(start, i));
        i += sep.length;
        start = i;
        continue;
      }
    }
    i += 1;
  }
  parts.push(text.slice(start));
  return parts;
}

// Index of the first `|` outside links and templates, or -1.
function topLevelPipe(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.startsWith('[[', i) || text.startsWith('{{', i)) {
      depth += 1;
      i += 1;
    } else if ((text.startsWith(']]', i) || text.startsWith('}}', i)) && depth > 0) {
      depth -= 1;
      i += 1;
    } else if (depth === 0 && text[i] === '|') {
      return i;
    }
  }
  return -1;
}

function readSpan(attributes: string, name: 'rowspan' | 'colspan'): number {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']?\\s*(\\d+)`, 'i').exec(attributes);
  if (!match) return 1;
  const n = Number(match[1]);
  return n >= 1 ? n : 1;
}

function parseCell(rawText: string, header: boolean): RawCell {
  let content = rawText;
  let attributes = '';
  const pipe = topLevelPipe(rawText);
  if (pipe >= 0) {
    const before = rawText.slice(0, pipe);
    if (before.includes('=') && !before.includes('[[') && !before.includes('{{')) {
      attributes = before;
      content = rawText.slice(pipe + 1);
    }
  }
  return {
    content,
    header,
    rowspan: readSpan(attributes, 'rowspan'),
    colspan: readSpan(attributes, 'colspan'),
  };
}

function currentRow(table: TableBuilder): RawCell[] {
  if (table.rows.length === 0) table.rows.push([]);
  return table.rows[table.rows.length - 1];
}

function finishTable(table: TableBuilder): WikiTable {
  const rawRows = table.rows.filter((row) => row.length > 0);
  let headers: string[] | null = null;
  const dataRows: RawCell[][] = [];
  for (const row of rawRows) {
    if (row.every((cell) => cell.header)) {
      if (headers === null) {
        headers = [];
        for (const cell of row) {
          for (let k = 0; k < cell.colspan; k += 1) headers.push(cell.content.trim());
        }
      }
      continue;
    }
    dataRows.push(row);
  }

  // Expand rowspan/colspan into a full grid.
  const pending: Array<{ content: string; remaining: number } | undefined> = [];
  const rows: string[][] = [];
  for (const row of dataRows) {
    const out: string[] = [];
    let col = 0;
    const fillPending = () => {
      while (pending[col] && (pending[col] as { remaining: number }).remaining > 0) {
        const p = pending[col] as { content: string; remaining: number };
        out[col] = p.content;
        p.remaining -= 1;
        col += 1;
      }
    };
    for (const cell of row) {
      fillPending();
      const content = cell.content.trim();
      for (let k = 0; k < cell.colspan; k += 1) {
        out[col] = content;
        pending[col] = cell.rowspan > 1 ? { content, remaining: cell.rowspan - 1 } : undefined;
        col += 1;
      }
    }
    fillPending();
    const width = Math.max(out.length, headers ? headers.length : 0);
    const full: string[] = [];
    for (let c = 0; c < width; c += 1) full.push(out[c] ?? '');
    rows.push(full);
  }

  return { caption: table.caption.trim(), headers: headers ?? [], rows };
}

export function parseWikitextTables(wikitext: string): WikiTable[] {
  const tables: WikiTable[] = [];
  let table: TableBuilder | null = null;
  let nested = 0;

  for (const rawLine of wikitext.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trimStart();

    if (table === null) {
      if (line.startsWith('{|')) table = { caption: '', rows: [], lastCell: null };
      continue;
    }

    if (nested > 0) {
      if (line.startsWith('{|')) nested += 1;
      else if (line.startsWith('|}')) nested -= 1;
      continue;
    }

    if (line.startsWith('{|')) {
      nested = 1;
      continue;
    }
    if (line.startsWith('|}')) {
      tables.push(finishTable(table));
      table = null;
      continue;
    }
    if (line.startsWith('|+')) {
      table.caption = line.slice(2);
      table.lastCell = null;
      continue;
    }
    if (line.startsWith('|-')) {
      table.rows.push([]);
      table.lastCell = null;
      continue;
    }
    if (line.startsWith('!')) {
      const row = currentRow(table);
      for (const part of splitTopLevel(line.slice(1), ['!!', '||'])) {
        const cell = parseCell(part, true);
        row.push(cell);
        table.lastCell = cell;
      }
      continue;
    }
    if (line.startsWith('|')) {
      const row = currentRow(table);
      for (const part of splitTopLevel(line.slice(1), ['||'])) {
        const cell = parseCell(part, false);
        row.push(cell);
        table.lastCell = cell;
      }
      continue;
    }
    if (table.lastCell) table.lastCell.content += `\n${line}`;
  }

  if (table !== null) tables.push(finishTable(table));
  return tables;
}

// Turns a wikitext fragment into plain text (see the steps below, applied in order).
export function cleanWikitext(text: string): string {
  let s = text;
  // 1. Comments.
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // 2. Footnotes: self-closing refs first, so `<ref name="x" />` isn't read as an opening tag.
  s = s.replace(/<ref\b[^>]*\/>/gi, '');
  s = s.replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, '');
  // 3. Templates, innermost first.
  let previous: string;
  do {
    previous = s;
    s = s.replace(/\{\{[^{}]*\}\}/g, '');
  } while (s !== previous);
  // 4. File and image links (their captions may hold links of their own).
  s = s.replace(/\[\[\s*(?:File|Image)\s*:[^[\]]*(?:\[\[[^[\]]*\]\][^[\]]*)*\]\]/gi, '');
  // 5. Wikilinks.
  s = s.replace(/\[\[([^[\]|]*)\|([^[\]]*)\]\]/g, '$2');
  s = s.replace(/\[\[([^[\]|]*)\]\]/g, '$1');
  // 6. External links.
  s = s.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]*)\]/gi, '$1');
  s = s.replace(/\[https?:\/\/[^\s\]]*\]/gi, '');
  // 7. Bold and italic.
  s = s.replace(/'''/g, '').replace(/''/g, '');
  // 8. Line breaks and other HTML tags.
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(/<\/?[a-z][^>]*>/gi, '');
  // 9. Entities.
  s = s.replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '–').replace(/&amp;/g, '&');
  // 10. Parentheses left empty.
  s = s.replace(/\(\s*\)/g, '');
  // 11. Whitespace.
  return s.replace(/\s+/g, ' ').trim();
}
