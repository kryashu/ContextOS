import type { DetectedKey, DuplicateKeyGroup } from './types.js';
import { RESULT_CAPS } from './types.js';

export interface DuplicateDetectorResult {
  duplicateGroups: DuplicateKeyGroup[];
  warnings: string[];
}

/**
 * Detect duplicate keys by grouping on keyType + normalizedValue.
 * Only returns groups with count > 1.
 * Applies result caps (max groups, max locations per group).
 */
export function detectDuplicates(keys: DetectedKey[]): DuplicateDetectorResult {
  const warnings: string[] = [];

  // Group by keyType + normalizedValue
  const groups = new Map<string, { keyType: DetectedKey['keyType']; value: string; normalizedValue: string; locations: DetectedKey['sourceRef'][] }>();

  for (const key of keys) {
    const groupKey = `${key.keyType}::${key.normalizedValue}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.locations.push(key.sourceRef);
      // Keep the first raw value as the display value
    } else {
      groups.set(groupKey, {
        keyType: key.keyType,
        value: key.value,
        normalizedValue: key.normalizedValue,
        locations: [key.sourceRef],
      });
    }
  }

  // Filter to duplicates only (count > 1), sort by count descending
  let duplicateGroups: DuplicateKeyGroup[] = [];
  for (const group of groups.values()) {
    if (group.locations.length > 1) {
      // Cap locations per group
      let locations = group.locations;
      if (locations.length > RESULT_CAPS.MAX_LOCATIONS_PER_GROUP) {
        warnings.push(
          `Duplicate group "${group.normalizedValue}" (${group.keyType}) has ${locations.length} locations, capped at ${RESULT_CAPS.MAX_LOCATIONS_PER_GROUP}.`,
        );
        locations = locations.slice(0, RESULT_CAPS.MAX_LOCATIONS_PER_GROUP);
      }

      duplicateGroups.push({
        keyType: group.keyType,
        value: group.value,
        normalizedValue: group.normalizedValue,
        count: group.locations.length,
        locations,
      });
    }
  }

  // Sort by count descending
  duplicateGroups.sort((a, b) => b.count - a.count);

  // Cap total groups
  if (duplicateGroups.length > RESULT_CAPS.MAX_DUPLICATE_GROUPS) {
    const totalFound = duplicateGroups.length;
    duplicateGroups = duplicateGroups.slice(0, RESULT_CAPS.MAX_DUPLICATE_GROUPS);
    warnings.push(
      `Results capped at ${RESULT_CAPS.MAX_DUPLICATE_GROUPS} duplicate groups (${totalFound} found).`,
    );
  }

  return { duplicateGroups, warnings };
}
