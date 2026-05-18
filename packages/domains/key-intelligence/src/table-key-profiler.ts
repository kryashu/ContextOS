import { loadTablesFromSources } from '@contextos/table-query';
import type { DetectedKey, KeyProfile } from './types.js';
import { detectKeyTypeFromColumn, detectKeyTypeFromValue } from './key-type-detector.js';
import { normalizeKeyValue } from './key-normalizer.js';

const MAX_EXAMPLES = 5;
const MIN_COLUMN_CONFIDENCE = 0.5;

export interface TableKeyProfilerResult {
  keyProfiles: KeyProfile[];
  detectedKeys: DetectedKey[];
}

/**
 * Profile tables in the sources directory, detecting key columns
 * and emitting DetectedKey entries for each cell.
 */
export function profileTableKeys(
  sourcesDir: string,
  fileScope?: string[],
): TableKeyProfilerResult {
  const tables = loadTablesFromSources(sourcesDir, fileScope);
  const keyProfiles: KeyProfile[] = [];
  const detectedKeys: DetectedKey[] = [];

  for (const table of tables) {
    for (const column of table.columns) {
      // Detect key type from column name
      const colDetection = detectKeyTypeFromColumn(column);

      // Gather all cell values for this column
      const values: Array<{ value: string; rowIndex: number }> = [];
      for (const row of table.rows) {
        const cellValue = row.values[column];
        if (cellValue != null) {
          const strVal = String(cellValue).trim();
          if (strVal) {
            values.push({ value: strVal, rowIndex: row.rowIndex });
          }
        }
      }

      // If column name doesn't match, try value-pattern on a sample
      let effectiveKeyType = colDetection.keyType;
      let effectiveConfidence = colDetection.confidence;

      if (effectiveKeyType === 'unknown' && values.length > 0) {
        // Sample up to 10 values to determine pattern
        const sample = values.slice(0, 10);
        const detections = sample.map((v) => detectKeyTypeFromValue(v.value, column));
        const matchedDetections = detections.filter((d) => d.keyType !== 'unknown');

        if (matchedDetections.length > 0) {
          // Pick the most common detected type
          const typeCounts = new Map<string, number>();
          for (const d of matchedDetections) {
            typeCounts.set(d.keyType, (typeCounts.get(d.keyType) ?? 0) + 1);
          }
          let bestType = 'unknown';
          let bestCount = 0;
          for (const [t, c] of typeCounts) {
            if (c > bestCount) {
              bestType = t;
              bestCount = c;
            }
          }
          // Require at least 50% of sampled values to match
          if (bestCount >= sample.length * 0.5) {
            effectiveKeyType = bestType as DetectedKey['keyType'];
            effectiveConfidence = matchedDetections.find((d) => d.keyType === bestType)?.confidence ?? 0.7;
          }
        }
      }

      // Skip columns that didn't pass detection
      if (effectiveKeyType === 'unknown' || effectiveConfidence < MIN_COLUMN_CONFIDENCE) {
        continue;
      }

      // Compute profile metrics
      const totalRows = table.rows.length;
      const nonEmptyCount = values.length;
      const nonEmptyRate = totalRows > 0 ? nonEmptyCount / totalRows : 0;

      const normalizedValues = values.map((v) => normalizeKeyValue(v.value, effectiveKeyType));
      const uniqueValues = new Set(normalizedValues);
      const uniquenessScore = nonEmptyCount > 0 ? uniqueValues.size / nonEmptyCount : 0;
      const duplicateCount = nonEmptyCount - uniqueValues.size;

      const examples = values.slice(0, MAX_EXAMPLES).map((v) => v.value);

      keyProfiles.push({
        fileName: table.fileName,
        sheet: table.sheet,
        fieldName: column,
        keyType: effectiveKeyType,
        nonEmptyRate,
        uniquenessScore,
        duplicateCount,
        examples,
      });

      // Emit DetectedKey for each cell
      for (let i = 0; i < values.length; i++) {
        const v = values[i]!;
        detectedKeys.push({
          keyType: effectiveKeyType,
          value: v.value,
          normalizedValue: normalizeKeyValue(v.value, effectiveKeyType),
          confidence: effectiveConfidence,
          sourceRef: {
            fileName: table.fileName,
            sheet: table.sheet,
            row: v.rowIndex,
            column,
            sourceRange: `${column}:${v.rowIndex}`,
          },
        });
      }
    }
  }

  return { keyProfiles, detectedKeys };
}
