// ── Types ────────────────────────────────────────────────────────────
export type {
  KeyType,
  KeySourceRef,
  DetectedKey,
  KeyProfile,
  DuplicateKeyGroup,
  DocumentKeyMatch,
  KeyRelationship,
  KeyIntelligenceStatus,
  KeyIntelligenceResult,
  KeyIntelligenceInput,
  KeyTypeDetectionResult,
} from './types.js';

export { RESULT_CAPS } from './types.js';

// ── Normalizer ──────────────────────────────────────────────────────
export {
  normalizeEmail,
  normalizePhone,
  normalizeGenericId,
  normalizeKeyValue,
} from './key-normalizer.js';

// ── Key type detector ───────────────────────────────────────────────
export {
  detectKeyTypeFromColumn,
  detectKeyTypeFromValue,
  detectKeyType,
} from './key-type-detector.js';

// ── Table key profiler ──────────────────────────────────────────────
export { profileTableKeys } from './table-key-profiler.js';
export type { TableKeyProfilerResult } from './table-key-profiler.js';

// ── Document key extractor ──────────────────────────────────────────
export { extractDocumentKeys } from './document-key-extractor.js';

// ── Duplicate detector ──────────────────────────────────────────────
export { detectDuplicates } from './duplicate-detector.js';
export type { DuplicateDetectorResult } from './duplicate-detector.js';

// ── Key relationship mapper ─────────────────────────────────────────
export { mapKeyRelationships } from './key-relationship-mapper.js';

// ── Engine ──────────────────────────────────────────────────────────
export {
  analyzeKeys,
  findDuplicateKeys,
  findDocumentsForKey,
} from './key-intelligence-engine.js';
