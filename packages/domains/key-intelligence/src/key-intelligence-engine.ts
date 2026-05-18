import type { KeyIntelligenceInput, KeyIntelligenceResult, KeyType } from './types.js';
import { RESULT_CAPS } from './types.js';
import { profileTableKeys } from './table-key-profiler.js';
import { extractDocumentKeys } from './document-key-extractor.js';
import { detectDuplicates } from './duplicate-detector.js';
import { mapKeyRelationships } from './key-relationship-mapper.js';
import { normalizeKeyValue } from './key-normalizer.js';

/**
 * Full key analysis: profile tables and documents, detect duplicates,
 * and map relationships.
 */
export function analyzeKeys(input: KeyIntelligenceInput): KeyIntelligenceResult {
  const warnings: string[] = [];

  // Profile tables
  const { keyProfiles, detectedKeys } = profileTableKeys(input.sourcesDir, input.fileScope);

  // Filter by keyType if specified
  const filteredProfiles = input.keyType
    ? keyProfiles.filter((p) => p.keyType === input.keyType)
    : keyProfiles;

  const filteredKeys = input.keyType
    ? detectedKeys.filter((k) => k.keyType === input.keyType)
    : detectedKeys;

  // Extract document keys
  let documentMatches = extractDocumentKeys(input.sourcesDir, input.outputDir);
  if (input.keyType) {
    documentMatches = documentMatches.filter((m) => m.keyType === input.keyType);
  }

  // Cap document matches
  if (documentMatches.length > RESULT_CAPS.MAX_DOCUMENT_MATCHES) {
    warnings.push(
      `Document matches capped at ${RESULT_CAPS.MAX_DOCUMENT_MATCHES} (${documentMatches.length} found).`,
    );
    documentMatches = documentMatches.slice(0, RESULT_CAPS.MAX_DOCUMENT_MATCHES);
  }

  // Detect duplicates
  const { duplicateGroups, warnings: dupWarnings } = detectDuplicates(filteredKeys);
  warnings.push(...dupWarnings);

  // Map relationships
  const relationships = mapKeyRelationships(filteredKeys, documentMatches);

  const hasResults = filteredProfiles.length > 0 || duplicateGroups.length > 0 ||
    documentMatches.length > 0 || relationships.length > 0;

  return {
    status: hasResults ? 'success' : 'no_matches',
    keyProfiles: filteredProfiles,
    duplicateGroups,
    documentMatches,
    relationships,
    warnings,
  };
}

/**
 * Find duplicate keys across tables.
 * Optionally filter by keyType or fieldName.
 */
export function findDuplicateKeys(input: KeyIntelligenceInput): KeyIntelligenceResult {
  const warnings: string[] = [];

  // Profile tables
  const { keyProfiles, detectedKeys } = profileTableKeys(input.sourcesDir, input.fileScope);

  // Filter detected keys
  let filteredKeys = detectedKeys;
  if (input.keyType) {
    filteredKeys = filteredKeys.filter((k) => k.keyType === input.keyType);
  }
  if (input.fieldName) {
    const fieldLower = input.fieldName.toLowerCase();
    filteredKeys = filteredKeys.filter((k) =>
      k.sourceRef.column?.toLowerCase() === fieldLower,
    );
  }

  // Detect duplicates
  const { duplicateGroups, warnings: dupWarnings } = detectDuplicates(filteredKeys);
  warnings.push(...dupWarnings);

  // Filter profiles to match
  const filteredProfiles = input.keyType
    ? keyProfiles.filter((p) => p.keyType === input.keyType)
    : keyProfiles;

  const hasResults = duplicateGroups.length > 0;

  return {
    status: hasResults ? 'success' : 'no_matches',
    keyProfiles: filteredProfiles,
    duplicateGroups,
    documentMatches: [],
    relationships: [],
    warnings,
  };
}

/**
 * Find documents and table rows that reference a specific key value.
 */
export function findDocumentsForKey(input: KeyIntelligenceInput): KeyIntelligenceResult {
  const warnings: string[] = [];

  if (!input.value) {
    return {
      status: 'needs_clarification',
      keyProfiles: [],
      duplicateGroups: [],
      documentMatches: [],
      relationships: [],
      warnings: ['No key value provided. Please specify the value to search for.'],
    };
  }

  const keyType: KeyType = input.keyType ?? 'unknown';
  const normalizedValue = normalizeKeyValue(input.value, keyType);

  // Profile tables to find matching rows
  const { detectedKeys } = profileTableKeys(input.sourcesDir, input.fileScope);

  // Find table keys matching the normalized value
  const matchingTableKeys = detectedKeys.filter((k) => {
    if (input.keyType && k.keyType !== input.keyType && k.keyType !== 'generic_id') {
      return false;
    }
    return k.normalizedValue === normalizedValue;
  });

  // Extract document keys
  let documentMatches = extractDocumentKeys(input.sourcesDir, input.outputDir);

  // Filter document matches to those matching the value
  documentMatches = documentMatches.filter((m) => {
    if (input.keyType && m.keyType !== input.keyType && m.keyType !== 'generic_id') {
      return false;
    }
    return m.normalizedValue === normalizedValue;
  });

  // Cap document matches
  if (documentMatches.length > RESULT_CAPS.MAX_DOCUMENT_MATCHES) {
    warnings.push(
      `Document matches capped at ${RESULT_CAPS.MAX_DOCUMENT_MATCHES} (${documentMatches.length} found).`,
    );
    documentMatches = documentMatches.slice(0, RESULT_CAPS.MAX_DOCUMENT_MATCHES);
  }

  // Build relationships
  const relationships = mapKeyRelationships(matchingTableKeys, documentMatches);

  const hasResults = matchingTableKeys.length > 0 || documentMatches.length > 0;

  return {
    status: hasResults ? 'success' : 'no_matches',
    keyProfiles: [],
    duplicateGroups: [],
    documentMatches,
    relationships,
    warnings,
  };
}
