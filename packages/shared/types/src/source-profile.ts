/**
 * Source profile — per-file analysis summary produced by the SourceProfiler.
 * Written to source-profiles.json for every workspace.
 */

export type SourceKind =
  | 'document'   // Markdown, text docs, meeting notes
  | 'workbook'   // Excel spreadsheets
  | 'config'     // JSON configs, YAML files
  | 'data'       // CSV data files, structured tables
  | 'notes'      // Plain text notes
  | 'unknown';

export interface SourceProfile {
  sourceId: string;
  fileName: string;
  fileType: string;
  sourceKind: SourceKind;
  summary: string;
  detectedTopics: string[];
  detectedEntities: string[];
  relevanceScore: number;   // 0–1
  warnings: string[];
}
