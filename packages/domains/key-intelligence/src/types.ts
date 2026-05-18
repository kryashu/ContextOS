// ── Key Types ────────────────────────────────────────────────────────

export type KeyType =
  | 'email'
  | 'phone'
  | 'product_id'
  | 'user_id'
  | 'customer_id'
  | 'employee_id'
  | 'license_number'
  | 'registration_id'
  | 'invoice_number'
  | 'order_id'
  | 'serial_number'
  | 'batch_number'
  | 'asset_id'
  | 'generic_id'
  | 'unknown';

// ── Source Reference ─────────────────────────────────────────────────

export interface KeySourceRef {
  fileName: string;
  sheet?: string;
  row?: number;
  column?: string;
  sourceRange?: string;
  snippet?: string;
}

// ── Detected Key ─────────────────────────────────────────────────────

export interface DetectedKey {
  keyType: KeyType;
  value: string;
  normalizedValue: string;
  confidence: number;
  sourceRef: KeySourceRef;
}

// ── Key Profile ──────────────────────────────────────────────────────

export interface KeyProfile {
  fileName: string;
  sheet?: string;
  fieldName: string;
  keyType: KeyType;
  nonEmptyRate: number;
  uniquenessScore: number;
  duplicateCount: number;
  examples: string[];
}

// ── Duplicate Key Group ──────────────────────────────────────────────

export interface DuplicateKeyGroup {
  keyType: KeyType;
  value: string;
  normalizedValue: string;
  count: number;
  locations: KeySourceRef[];
}

// ── Document Key Match ───────────────────────────────────────────────

export interface DocumentKeyMatch {
  fileName: string;
  keyType: KeyType;
  value: string;
  normalizedValue: string;
  evidence: string;
  sourceRef: KeySourceRef;
}

// ── Key Relationship ─────────────────────────────────────────────────

export interface KeyRelationship {
  keyType: KeyType;
  value: string;
  normalizedValue: string;
  tableMatches: KeySourceRef[];
  documentMatches: DocumentKeyMatch[];
  confidence: number;
}

// ── Result ───────────────────────────────────────────────────────────

export type KeyIntelligenceStatus =
  | 'success'
  | 'no_matches'
  | 'needs_clarification'
  | 'error';

export interface KeyIntelligenceResult {
  status: KeyIntelligenceStatus;
  keyProfiles: KeyProfile[];
  duplicateGroups: DuplicateKeyGroup[];
  documentMatches: DocumentKeyMatch[];
  relationships: KeyRelationship[];
  warnings: string[];
}

// ── Engine Input ─────────────────────────────────────────────────────

export interface KeyIntelligenceInput {
  sourcesDir: string;
  outputDir: string;
  keyType?: KeyType;
  value?: string;
  fieldName?: string;
  fileScope?: string[];
}

// ── Key Type Detection Result ────────────────────────────────────────

export interface KeyTypeDetectionResult {
  keyType: KeyType;
  confidence: number;
  reason: string;
}

// ── Result Caps ──────────────────────────────────────────────────────

export const RESULT_CAPS = {
  MAX_DUPLICATE_GROUPS: 50,
  MAX_LOCATIONS_PER_GROUP: 25,
  MAX_DOCUMENT_MATCHES: 50,
  MAX_EVIDENCE_SNIPPET_LENGTH: 240,
} as const;
