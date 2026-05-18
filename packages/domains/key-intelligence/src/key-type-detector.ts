import type { KeyType, KeyTypeDetectionResult } from './types.js';

// ── Column-name heuristic patterns ──────────────────────────────────

interface ColumnPattern {
  keyType: KeyType;
  patterns: RegExp[];
}

const COLUMN_PATTERNS: ColumnPattern[] = [
  {
    keyType: 'email',
    patterns: [/email/i, /e[-_]?mail/i],
  },
  {
    keyType: 'phone',
    patterns: [/phone/i, /mobile/i, /contact\s*(?:no|number|#)?/i, /tel(?:ephone)?/i, /cell/i],
  },
  {
    keyType: 'product_id',
    patterns: [/sku/i, /product[\s_-]*(?:code|id|no|number|#)/i, /item[\s_-]*(?:code|id|no|number|#)/i, /part[\s_-]*(?:code|id|no|number|#)/i],
  },
  {
    keyType: 'user_id',
    patterns: [/user[\s_-]*(?:id|code|no|number|#)/i],
  },
  {
    keyType: 'customer_id',
    patterns: [/customer[\s_-]*(?:id|code|no|number|#)/i, /client[\s_-]*(?:id|code|no|number|#)/i],
  },
  {
    keyType: 'employee_id',
    patterns: [/employee[\s_-]*(?:id|code|no|number|#)/i, /emp[\s_-]*(?:id|code|no|number|#)/i, /staff[\s_-]*(?:id|code|no|number|#)/i],
  },
  {
    keyType: 'license_number',
    patterns: [/licen[sc]e[\s_-]*(?:no|number|#|id)?/i, /lic[\s_-]*(?:no|number|#|id)/i],
  },
  {
    keyType: 'registration_id',
    patterns: [/registration[\s_-]*(?:no|number|#|id)?/i, /reg[\s_-]*(?:no|number|#|id)/i],
  },
  {
    keyType: 'invoice_number',
    patterns: [/invoice[\s_-]*(?:no|number|#|id)?/i, /inv[\s_-]*(?:no|number|#|id)/i],
  },
  {
    keyType: 'order_id',
    patterns: [/order[\s_-]*(?:no|number|#|id)?/i],
  },
  {
    keyType: 'serial_number',
    patterns: [/serial[\s_-]*(?:no|number|#|id)?/i],
  },
  {
    keyType: 'batch_number',
    patterns: [/batch[\s_-]*(?:no|number|#|id)?/i, /lot[\s_-]*(?:no|number|#|id)?/i],
  },
  {
    keyType: 'asset_id',
    patterns: [/asset[\s_-]*(?:id|code|no|number|#|tag)?/i],
  },
];

// ── Value-pattern regexes ────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;

/**
 * Conservative generic_id pattern:
 * - At least 1 letter AND at least 1 digit
 * - Total length >= 5
 * - Allows letters, digits, hyphens, underscores, dots, slashes
 */
const GENERIC_ID_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9\-_./]{5,}$/;

/**
 * Date patterns to reject from generic_id detection.
 */
const DATE_REJECT_REGEX = /^\d{4}[-/]\d{2}[-/]\d{2}$/;

// ── Label keywords that boost generic_id confidence ──────────────────

const ID_LABEL_KEYWORDS = [
  'product', 'user', 'customer', 'license', 'licence',
  'registration', 'invoice', 'order', 'asset', 'serial',
  'batch', 'id', 'code', 'number', 'no', 'ref', 'reference',
];

// ── Public API ───────────────────────────────────────────────────────

/**
 * Detect key type from a column name (header).
 */
export function detectKeyTypeFromColumn(columnName: string): KeyTypeDetectionResult {
  const normalized = columnName.trim();
  if (!normalized) {
    return { keyType: 'unknown', confidence: 0, reason: 'Empty column name' };
  }

  for (const { keyType, patterns } of COLUMN_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return {
          keyType,
          confidence: 0.9,
          reason: `Column name "${normalized}" matches ${keyType} pattern`,
        };
      }
    }
  }

  return { keyType: 'unknown', confidence: 0, reason: `No column-name pattern matched "${normalized}"` };
}

/**
 * Detect key type from a cell value.
 * Uses value-pattern heuristics.
 * Optional `columnContext` provides the column name for boosting confidence.
 */
export function detectKeyTypeFromValue(
  value: string,
  columnContext?: string,
): KeyTypeDetectionResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { keyType: 'unknown', confidence: 0, reason: 'Empty value' };
  }

  // Email detection
  if (EMAIL_REGEX.test(trimmed)) {
    return { keyType: 'email', confidence: 0.95, reason: 'Value matches email pattern' };
  }

  // Phone detection
  if (PHONE_REGEX.test(trimmed)) {
    const digitCount = trimmed.replace(/\D/g, '').length;
    if (digitCount >= 7 && digitCount <= 15) {
      return { keyType: 'phone', confidence: 0.8, reason: 'Value matches phone pattern' };
    }
  }

  // Generic ID detection (conservative)
  if (DATE_REJECT_REGEX.test(trimmed)) {
    return { keyType: 'unknown', confidence: 0, reason: 'Value looks like a date, not an ID' };
  }

  if (GENERIC_ID_REGEX.test(trimmed)) {
    // Check if column context provides a label keyword boost
    const hasLabelContext = columnContext
      ? ID_LABEL_KEYWORDS.some((kw) => columnContext.toLowerCase().includes(kw))
      : false;

    const confidence = hasLabelContext ? 0.85 : 0.6;
    return {
      keyType: 'generic_id',
      confidence,
      reason: hasLabelContext
        ? `Value "${trimmed}" is alphanumeric ID near label "${columnContext}"`
        : `Value "${trimmed}" matches generic ID pattern (no label context)`,
    };
  }

  return { keyType: 'unknown', confidence: 0, reason: `No value pattern matched "${trimmed}"` };
}

/**
 * Combined detection: first try column name, then value pattern.
 * Column detection takes priority if it matches.
 */
export function detectKeyType(
  value: string,
  columnName?: string,
): KeyTypeDetectionResult {
  // If column name provides a strong signal, use it
  if (columnName) {
    const colResult = detectKeyTypeFromColumn(columnName);
    if (colResult.keyType !== 'unknown') {
      return colResult;
    }
  }

  // Fall back to value-pattern detection
  return detectKeyTypeFromValue(value, columnName);
}
