import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// The CC0 prompt catalog source (prompts.chat). Overridable via env for tests /
// mirrors; falls back to the upstream raw CSV.
export const DEFAULT_MARKETPLACE_CSV_URL =
  'https://raw.githubusercontent.com/f/prompts.chat/main/prompts.csv';

const FETCH_TIMEOUT_MS = 20_000;

// One parsed catalog row (columns: act,prompt,for_devs,type,contributor).
export interface MarketplaceCsvRow {
  act: string;
  prompt: string;
  forDevs: boolean;
  type: string;
  contributor: string;
}

// Parse RFC-4180 CSV into rows of fields. Handles quoted fields, embedded commas
// and newlines, doubled-quote escaping ("" -> "), and CRLF/LF line endings.
// Pure + exported so the parser is unit-testable without the network.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote inside a quoted field.
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      endField();
      i += 1;
      continue;
    }
    if (c === '\r') {
      // Treat CRLF (and a bare CR) as one line break.
      endRow();
      if (text[i + 1] === '\n') i += 2;
      else i += 1;
      continue;
    }
    if (c === '\n') {
      endRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  // Flush the trailing field/row unless the input ended on a clean newline.
  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

// Parse the prompts.csv body into typed rows. The header row is consumed and
// columns are mapped positionally (act,prompt,for_devs,type,contributor).
export function parseMarketplaceCsv(text: string): MarketplaceCsvRow[] {
  const records = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (records.length <= 1) return [];
  const out: MarketplaceCsvRow[] = [];
  for (const cols of records.slice(1)) {
    const act = (cols[0] ?? '').trim();
    const prompt = cols[1] ?? '';
    if (!act || !prompt.trim()) continue;
    const forDevsRaw = (cols[2] ?? '').trim().toLowerCase();
    out.push({
      act,
      prompt,
      forDevs: forDevsRaw === 'true',
      type: (cols[3] ?? '').trim(),
      contributor: (cols[4] ?? '').trim(),
    });
  }
  return out;
}

// Fetches + parses the catalog CSV. Native fetch with a ~20s abort timeout; no
// SDK. Injectable so the service can be tested against a stub.
@Injectable()
export class MarketplaceFetcher {
  constructor(private readonly config: ConfigService) {}

  private url(): string {
    return (
      this.config.get<string>('MARKETPLACE_CSV_URL') ??
      DEFAULT_MARKETPLACE_CSV_URL
    );
  }

  async fetchRows(): Promise<MarketplaceCsvRow[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(this.url(), { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Marketplace CSV fetch failed (${res.status})`);
      }
      const text = await res.text();
      return parseMarketplaceCsv(text);
    } finally {
      clearTimeout(timer);
    }
  }
}
