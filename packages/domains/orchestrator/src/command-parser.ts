import type { CommandFilter, CommandAggregation, AggregationOperation } from './types.js';

// ── Date normalization ──────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

/**
 * Normalize a human-readable date fragment to ISO-like YYYY-MM-DD.
 * Handles: "5 May 2025", "5th May 2025", "May 5, 2025", "2025-05-05"
 */
export function normalizeDateToIsoLikeString(dateStr: string): string | null {
  const trimmed = dateStr.trim();

  // Already ISO
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  // "5 May 2025" or "5th May 2025"
  const dmyMatch = trimmed.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/,
  );
  if (dmyMatch) {
    const month = MONTH_MAP[dmyMatch[2]!.toLowerCase()];
    if (month) {
      return `${dmyMatch[3]}-${month}-${dmyMatch[1]!.padStart(2, '0')}`;
    }
  }

  // "May 5, 2025" or "May 5 2025"
  const mdyMatch = trimmed.match(
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/,
  );
  if (mdyMatch) {
    const month = MONTH_MAP[mdyMatch[1]!.toLowerCase()];
    if (month) {
      return `${mdyMatch[3]}-${month}-${mdyMatch[2]!.padStart(2, '0')}`;
    }
  }

  return null;
}

// ── Date extraction ─────────────────────────────────────────────────

const DATE_PATTERN =
  /(?:before|after|since|until|by)\s+((?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})|(?:[A-Za-z]+\s+\d{1,2},?\s+\d{4})|(?:\d{4}-\d{2}-\d{2}))/gi;

export function extractDates(command: string): CommandFilter[] {
  const filters: CommandFilter[] = [];
  let match: RegExpExecArray | null;

  while ((match = DATE_PATTERN.exec(command)) !== null) {
    const fullMatch = match[0]!.toLowerCase();
    const dateStr = match[1]!;
    const normalized = normalizeDateToIsoLikeString(dateStr);
    if (!normalized) continue;

    let operator: 'before' | 'after' = 'before';
    if (fullMatch.startsWith('after') || fullMatch.startsWith('since')) {
      operator = 'after';
    }

    filters.push({ field: 'date', operator, value: normalized });
  }

  return filters;
}

// ── Key-value extraction ────────────────────────────────────────────

const KEY_VALUE_PATTERNS = [
  // Quoted values: "ABC-123"
  /(?:product|item|sku|code|id|key|email|order)\s+["']([^"']+)["']/gi,
  // Alphanumeric IDs: product ABC-123
  /(?:product|item|sku|code|id|key|order)\s+([A-Z0-9][A-Z0-9_-]{1,30})/gi,
  // Email-like: duplicate emails
  /duplicate\s+(email|id|key|sku|code|order)s?/gi,
];

export function extractPossibleKeyValues(command: string): string[] {
  const values: string[] = [];

  for (const pattern of KEY_VALUE_PATTERNS) {
    let match: RegExpExecArray | null;
    // Reset lastIndex for global regex reuse
    pattern.lastIndex = 0;
    while ((match = pattern.exec(command)) !== null) {
      const val = match[1]!.trim();
      // Skip generic field names that aren't actual key values
      if (['email', 'id', 'key', 'sku', 'code', 'order'].includes(val.toLowerCase())) continue;
      if (val && !values.includes(val)) {
        values.push(val);
      }
    }
  }

  return values;
}

// ── Aggregation detection ───────────────────────────────────────────

const AGG_OPERATION_MAP: Array<{ keywords: string[]; operation: AggregationOperation }> = [
  { keywords: ['total', 'sum', 'sum of'], operation: 'sum' },
  { keywords: ['count', 'how many', 'number of'], operation: 'count' },
  { keywords: ['average', 'avg', 'mean'], operation: 'average' },
  { keywords: ['minimum', 'min', 'lowest', 'smallest'], operation: 'min' },
  { keywords: ['maximum', 'max', 'highest', 'largest'], operation: 'max' },
];

export function detectAggregationOperation(command: string): AggregationOperation | null {
  const lower = command.toLowerCase();
  for (const entry of AGG_OPERATION_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) return entry.operation;
    }
  }
  return null;
}

// ── Aggregate field extraction ──────────────────────────────────────

/**
 * Clean trailing punctuation and conjunctions from an extracted field name.
 */
function cleanFieldName(raw: string): string {
  return raw
    .replace(/[.,;]+$/, '')
    .replace(/\s+and\s*$/, '')
    .trim();
}

/**
 * Extract individual aggregation entries from a comma/and-separated field list.
 * Example: "units sold, total units in transit, and total units with retailers"
 * → ["units sold", "units in transit", "units with retailers"]
 */
function splitAggregationFields(raw: string, operation: AggregationOperation): CommandAggregation[] {
  const results: CommandAggregation[] = [];

  // Split on comma or ", and" or " and " when followed by an aggregation keyword repeat
  // Pattern: ", total X" or ", and total X" or " and total X"
  const parts = raw.split(/,\s*(?:and\s+)?(?:total|sum of|count|average|avg|min|max)\s+|\s+and\s+(?:total|sum of|count|average|avg|min|max)\s+/i);

  // First part is the field after the initial keyword
  const firstField = cleanFieldName(parts[0] ?? '');
  if (firstField.length > 0 && firstField.length < 100) {
    results.push({ field: firstField, operation, label: `${operation} of ${firstField}` });
  }

  // Remaining parts are the fields after each repeated keyword
  for (let i = 1; i < parts.length; i++) {
    const field = cleanFieldName(parts[i] ?? '');
    if (field.length > 0 && field.length < 100) {
      results.push({ field, operation, label: `${operation} of ${field}` });
    }
  }

  return results;
}

const AGG_FIELD_PATTERN =
  /(?:calculate total|calculate|total|sum of|count|average|avg|min of|max of|minimum|maximum)\s+(.+?)(?:\s+(?:by|for|from|where|before|after|and calculate)\b)/gi;

const AGG_FIELD_PATTERN_EOL =
  /(?:calculate total|calculate|total|sum of|count|average|avg|min of|max of|minimum|maximum)\s+(.+?)\s*[.?!]?\s*$/i;

export function extractAggregateFields(command: string): CommandAggregation[] {
  const aggregations: CommandAggregation[] = [];
  const operation = detectAggregationOperation(command) ?? 'sum';

  // Strategy 1: Try the primary pattern (field followed by known delimiters)
  AGG_FIELD_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = AGG_FIELD_PATTERN.exec(command)) !== null) {
    const raw = match[1]!.trim();
    const expanded = splitAggregationFields(raw, operation);
    aggregations.push(...expanded);
  }

  // Strategy 2: Try end-of-line pattern (field runs to end of sentence)
  if (aggregations.length === 0) {
    const eolMatch = command.match(AGG_FIELD_PATTERN_EOL);
    if (eolMatch) {
      const raw = eolMatch[1]!.trim();
      const expanded = splitAggregationFields(raw, operation);
      aggregations.push(...expanded);
    }
  }

  // Strategy 3: Fallback — split on "and calculate" / "and total" for compound queries
  if (aggregations.length === 0) {
    const segments = command.split(/\band\s+(?:calculate\s+)?(?:total|sum of|count|average|min|max)\s+/i);
    for (const segment of segments) {
      const subOp = detectAggregationOperation(segment) ?? operation;
      const subMatch = segment.match(
        /(?:total|sum of|count|average|min|max)\s+(.+?)(?:\s+(?:by|for|from|where|before|after)|\s*[.?!]?\s*$)/i,
      );
      if (subMatch) {
        const field = cleanFieldName(subMatch[1]!);
        if (field.length > 0 && field.length < 100) {
          aggregations.push({ field, operation: subOp, label: `${subOp} of ${field}` });
        }
      }
    }
  }

  return aggregations;
}

// ── Key type extraction ─────────────────────────────────────────────

const KEY_TYPE_PHRASES: Array<{ phrases: string[]; keyType: string }> = [
  { phrases: ['email', 'emails', 'e-mail', 'e-mails'], keyType: 'email' },
  { phrases: ['phone number', 'phone numbers', 'phone', 'phones', 'mobile', 'mobiles'], keyType: 'phone' },
  { phrases: ['product id', 'product ids', 'product code', 'product codes', 'sku', 'skus'], keyType: 'product_id' },
  { phrases: ['user id', 'user ids'], keyType: 'user_id' },
  { phrases: ['customer id', 'customer ids', 'client id', 'client ids'], keyType: 'customer_id' },
  { phrases: ['employee id', 'employee ids', 'emp id', 'emp ids'], keyType: 'employee_id' },
  { phrases: ['license number', 'license numbers', 'licence number', 'licence numbers', 'license', 'licenses', 'licence', 'licences'], keyType: 'license_number' },
  { phrases: ['registration id', 'registration ids', 'registration number', 'registration numbers'], keyType: 'registration_id' },
  { phrases: ['invoice number', 'invoice numbers', 'invoice', 'invoices'], keyType: 'invoice_number' },
  { phrases: ['order id', 'order ids', 'order number', 'order numbers'], keyType: 'order_id' },
  { phrases: ['serial number', 'serial numbers', 'serial'], keyType: 'serial_number' },
  { phrases: ['batch number', 'batch numbers', 'lot number', 'lot numbers'], keyType: 'batch_number' },
  { phrases: ['asset id', 'asset ids', 'asset tag', 'asset tags'], keyType: 'asset_id' },
];

/**
 * Extract key type from command phrases like "duplicate emails" → "email"
 */
export function extractKeyType(command: string): string | null {
  const lower = command.toLowerCase();
  for (const { phrases, keyType } of KEY_TYPE_PHRASES) {
    for (const phrase of phrases) {
      if (lower.includes(phrase)) {
        return keyType;
      }
    }
  }
  return null;
}

// ── Filter expression extraction ────────────────────────────────────

export function extractFilterExpressions(command: string): CommandFilter[] {
  const filters: CommandFilter[] = [];

  // Date-based filters
  filters.push(...extractDates(command));

  // Comparison filters: "greater than X", "less than X"
  const comparisonPattern =
    /(?:greater than|more than|above|over)\s+(\d+(?:\.\d+)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = comparisonPattern.exec(command)) !== null) {
    filters.push({ field: 'value', operator: 'greater_than', value: match[1]! });
  }

  const ltPattern = /(?:less than|fewer than|below|under)\s+(\d+(?:\.\d+)?)/gi;
  while ((match = ltPattern.exec(command)) !== null) {
    filters.push({ field: 'value', operator: 'less_than', value: match[1]! });
  }

  return filters;
}
