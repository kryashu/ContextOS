import type { DetectedKey, DocumentKeyMatch, KeyRelationship } from './types.js';

/**
 * Map relationships between table keys and document keys.
 * Matches by keyType + normalizedValue.
 *
 * Confidence:
 * - Exact normalized match with matching keyType = 0.95
 * - Match where one side is 'unknown' or 'generic_id' = 0.75
 */
export function mapKeyRelationships(
  tableKeys: DetectedKey[],
  documentMatches: DocumentKeyMatch[],
): KeyRelationship[] {
  // Index table keys by normalizedValue
  const tableIndex = new Map<string, DetectedKey[]>();
  for (const key of tableKeys) {
    const indexKey = key.normalizedValue;
    const existing = tableIndex.get(indexKey);
    if (existing) {
      existing.push(key);
    } else {
      tableIndex.set(indexKey, [key]);
    }
  }

  // Index document matches by normalizedValue
  const docIndex = new Map<string, DocumentKeyMatch[]>();
  for (const match of documentMatches) {
    const indexKey = match.normalizedValue;
    const existing = docIndex.get(indexKey);
    if (existing) {
      existing.push(match);
    } else {
      docIndex.set(indexKey, [match]);
    }
  }

  // Find intersections
  const relationships: KeyRelationship[] = [];
  const processedKeys = new Set<string>();

  for (const [normalizedValue, tableDocs] of tableIndex) {
    const matchingDocs = docIndex.get(normalizedValue);
    if (!matchingDocs || matchingDocs.length === 0) continue;

    // Determine best keyType from the matches
    const tableKeyType = tableDocs[0]!.keyType;
    const docKeyType = matchingDocs[0]!.keyType;

    // Use the more specific key type
    let keyType = tableKeyType;
    if (tableKeyType === 'unknown' || tableKeyType === 'generic_id') {
      keyType = docKeyType !== 'unknown' ? docKeyType : tableKeyType;
    }

    // Compute confidence
    const typesMatch = tableKeyType === docKeyType;
    const hasUnknown = tableKeyType === 'unknown' || docKeyType === 'unknown' ||
      tableKeyType === 'generic_id' || docKeyType === 'generic_id';
    const confidence = typesMatch && !hasUnknown ? 0.95 : 0.75;

    const relationKey = `${keyType}::${normalizedValue}`;
    if (processedKeys.has(relationKey)) continue;
    processedKeys.add(relationKey);

    relationships.push({
      keyType,
      value: tableDocs[0]!.value,
      normalizedValue,
      tableMatches: tableDocs.map((k) => k.sourceRef),
      documentMatches: matchingDocs,
      confidence,
    });
  }

  // Sort by confidence descending, then by number of matches
  relationships.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return (b.tableMatches.length + b.documentMatches.length) -
      (a.tableMatches.length + a.documentMatches.length);
  });

  return relationships;
}
