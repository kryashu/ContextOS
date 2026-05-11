import { readFileSync, statSync } from 'node:fs';
import * as XLSX from 'xlsx';
import type { Source, SourceType } from '@contextos/types';
import type { SourceParser } from './types.js';

// --- Normalized observation shape (future-facing for VS004B/VS004C) ---
export interface NormalizedObservation {
  sheet: string;
  section: string;
  variety: string;
  plantPart: string;
  treatment: string;
  metric: string;
  value: number | null;
  unit: string;
  sourceCell: string;
  sourceRange: string;
}

export interface SheetProfile {
  name: string;
  usedRange: string;
  rowCount: number;
  colCount: number;
  detectedSections: string[];
  detectedTables: TableBlock[];
}

export interface TableBlock {
  range: string;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  plantPart: string;
  variety: string;
  treatments: string[];
  headerRow: string[];
  sectionHeader: string;
}

export interface WorkbookProfile {
  fileName: string;
  sheets: SheetProfile[];
  totalSheets: number;
  totalTables: number;
  totalObservations: number;
  candidateMetrics: string[];
  warnings: string[];
  generatedAt: string;
}

// --- Known patterns ---
const TREATMENT_PATTERNS = ['CK', 'As', 'As+GABA', 'As+GABA+3-MP'];
const PLANT_PART_PATTERNS = ['Shoot', 'Root', 'shoot', 'root'];
const VARIETY_PATTERNS = [
  'Tolerant variety', 'Sensitive variety',
  'tolerant variety', 'sensitive variety',
  'Tolerant Variety', 'Sensitive Variety',
];

export class ExcelParser implements SourceParser {
  canParse(fileType: SourceType): boolean {
    return fileType === 'xlsx';
  }

  async parse(source: Partial<Source>): Promise<Source> {
    if (!source.filePath) {
      throw new Error('ExcelParser requires filePath (binary file — cannot use rawContent)');
    }

    try {
      const fileBuffer = readFileSync(source.filePath);
      const fileSize = statSync(source.filePath).size;
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

      const profile = this.profileWorkbook(workbook, source.fileName ?? 'unknown.xlsx');
      const observations = this.extractAllObservations(workbook, profile);

      profile.totalObservations = observations.length;

      // Generate a human-readable text summary for rawContent
      const textSummary = this.generateTextSummary(profile, observations);

      return {
        id: source.id ?? this.generateId(),
        workspaceId: source.workspaceId ?? '',
        fileName: source.fileName ?? 'unknown.xlsx',
        filePath: source.filePath,
        fileType: 'xlsx',
        fileSize,
        fileHash: this.computeHash(textSummary),
        rawContent: textSummary,
        structuredData: {
          workbookProfile: profile as unknown as Record<string, unknown>,
          normalizedObservations: observations as unknown as Record<string, unknown>,
        },
        status: 'completed',
        parsedAt: new Date(),
        createdAt: source.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      return {
        id: source.id ?? this.generateId(),
        workspaceId: source.workspaceId ?? '',
        fileName: source.fileName ?? 'unknown.xlsx',
        filePath: source.filePath,
        fileType: 'xlsx',
        fileSize: 0,
        fileHash: '',
        rawContent: '',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Excel parsing failed',
        createdAt: source.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
    }
  }

  // --- Profiling ---

  private profileWorkbook(workbook: XLSX.WorkBook, fileName: string): WorkbookProfile {
    const sheets: SheetProfile[] = [];
    const warnings: string[] = [];
    const allMetrics = new Set<string>();

    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      if (!ws) {
        warnings.push(`Sheet "${sheetName}" is empty or inaccessible.`);
        continue;
      }

      const ref = ws['!ref'];
      if (!ref) {
        sheets.push({
          name: sheetName,
          usedRange: '',
          rowCount: 0,
          colCount: 0,
          detectedSections: [],
          detectedTables: [],
        });
        continue;
      }

      const range = XLSX.utils.decode_range(ref);
      const rowCount = range.e.r - range.s.r + 1;
      const colCount = range.e.c - range.s.c + 1;

      const cells = this.readCells(ws, range);
      const sections = this.detectSectionHeaders(cells, range);
      const tables = this.detectTableBlocks(cells, range, sheetName, sections);

      for (const t of tables) {
        if (t.sectionHeader) allMetrics.add(t.sectionHeader);
      }

      sheets.push({
        name: sheetName,
        usedRange: ref,
        rowCount,
        colCount,
        detectedSections: sections.map(s => s.text),
        detectedTables: tables,
      });
    }

    return {
      fileName,
      sheets,
      totalSheets: sheets.length,
      totalTables: sheets.reduce((n, s) => n + s.detectedTables.length, 0),
      totalObservations: 0, // filled later
      candidateMetrics: [...allMetrics],
      warnings,
      generatedAt: new Date().toISOString(),
    };
  }

  // --- Cell reading ---

  private readCells(
    ws: XLSX.WorkSheet,
    range: XLSX.Range,
  ): Map<string, string> {
    const cells = new Map<string, string>();
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr] as XLSX.CellObject | undefined;
        if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
          cells.set(addr, String(cell.v).trim());
        }
      }
    }
    return cells;
  }

  // --- Section header detection ---

  private detectSectionHeaders(
    cells: Map<string, string>,
    range: XLSX.Range,
  ): Array<{ row: number; text: string }> {
    const sections: Array<{ row: number; text: string }> = [];

    for (let r = range.s.r; r <= range.e.r; r++) {
      // Collect all non-empty cells in this row
      const rowCells: Array<{ col: number; val: string }> = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const val = cells.get(addr);
        if (val) rowCells.push({ col: c, val });
      }

      // A section header: single non-empty cell in col A/B, looks like a label (not a number, not a treatment)
      if (rowCells.length === 1 && rowCells[0]!.col <= 1) {
        const text = rowCells[0]!.val;
        if (!this.isNumericish(text) && !this.isTreatmentLabel(text) && text.length > 2) {
          sections.push({ row: r, text });
        }
      }
      // Also detect rows that span across and look like headers (bold-like: text in first cell, rest empty or very few)
      else if (rowCells.length <= 2 && rowCells.length > 0) {
        const first = rowCells[0]!.val;
        if (
          !this.isNumericish(first) &&
          !this.isTreatmentLabel(first) &&
          !this.isPlantPartLabel(first) &&
          !this.isVarietyLabel(first) &&
          first.length > 3 &&
          rowCells.every(rc => !this.isNumericish(rc.val))
        ) {
          // Avoid duplicates
          if (!sections.some(s => s.row === r)) {
            sections.push({ row: r, text: first });
          }
        }
      }
    }

    return sections;
  }

  // --- Table block detection ---

  private detectTableBlocks(
    cells: Map<string, string>,
    range: XLSX.Range,
    _sheetName: string,
    sections: Array<{ row: number; text: string }>,
  ): TableBlock[] {
    const tables: TableBlock[] = [];

    // Find rows that contain treatment labels — these are data rows
    const treatmentRows: Array<{ row: number; col: number; treatment: string }> = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const val = cells.get(addr);
        if (val && this.isTreatmentLabel(val)) {
          treatmentRows.push({ row: r, col: c, treatment: val });
        }
      }
    }

    if (treatmentRows.length === 0) return tables;

    // Group consecutive treatment rows into blocks
    const blocks = this.groupTreatmentRows(treatmentRows);

    for (const block of blocks) {
      const startRow = block[0]!.row;
      const endRow = block[block.length - 1]!.row;
      const treatmentCol = block[0]!.col;

      // Find the data extent (columns with numeric data in these rows)
      let minCol = treatmentCol;
      let maxCol = treatmentCol;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (cells.has(addr)) {
            if (c < minCol) minCol = c;
            if (c > maxCol) maxCol = c;
          }
        }
      }

      // Look for a header row just above the block
      const headerRow = this.findHeaderRow(cells, startRow, minCol, maxCol);

      // Determine plant part and variety by scanning rows above the block
      const plantPart = this.findLabelAbove(cells, startRow, range.s.r, PLANT_PART_PATTERNS);
      const variety = this.findLabelAbove(cells, startRow, range.s.r, VARIETY_PATTERNS);

      // Find the nearest section header above
      const sectionHeader = this.findNearestSectionAbove(sections, startRow);

      const rangeStr =
        XLSX.utils.encode_cell({ r: headerRow ?? startRow, c: minCol }) +
        ':' +
        XLSX.utils.encode_cell({ r: endRow, c: maxCol });

      tables.push({
        range: rangeStr,
        startRow: headerRow ?? startRow,
        endRow,
        startCol: minCol,
        endCol: maxCol,
        plantPart,
        variety,
        treatments: block.map(b => b.treatment),
        headerRow: headerRow !== null ? this.readRow(cells, headerRow, minCol, maxCol) : [],
        sectionHeader,
      });
    }

    return tables;
  }

  // --- Observation extraction ---

  private extractAllObservations(
    workbook: XLSX.WorkBook,
    profile: WorkbookProfile,
  ): NormalizedObservation[] {
    const observations: NormalizedObservation[] = [];

    for (const sheetProfile of profile.sheets) {
      for (const table of sheetProfile.detectedTables) {
        const ws = workbook.Sheets[sheetProfile.name];
        if (!ws) continue;

        const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
        const cells = this.readCells(ws, range);

        // Each treatment row has: treatment label in treatmentCol, then numeric values
        for (let r = table.startRow; r <= table.endRow; r++) {
          // Find treatment label for this row
          let treatment = '';
          for (let c = table.startCol; c <= table.endCol; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const val = cells.get(addr);
            if (val && this.isTreatmentLabel(val)) {
              treatment = val;
              break;
            }
          }
          if (!treatment) continue;

          // Extract numeric values from remaining columns
          for (let c = table.startCol; c <= table.endCol; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const val = cells.get(addr);
            if (!val || !this.isNumericish(val) || this.isTreatmentLabel(val)) continue;

            // Determine metric name from header row
            let metric = table.sectionHeader || sheetProfile.name;
            if (table.headerRow.length > 0) {
              const colIdx = c - table.startCol;
              if (colIdx < table.headerRow.length && table.headerRow[colIdx]) {
                const headerVal = table.headerRow[colIdx]!;
                if (headerVal && !this.isTreatmentLabel(headerVal)) {
                  metric = headerVal;
                }
              }
            }

            observations.push({
              sheet: sheetProfile.name,
              section: table.sectionHeader,
              variety: table.variety,
              plantPart: table.plantPart,
              treatment,
              metric,
              value: this.parseNumber(val),
              unit: '', // unit extraction deferred to VS004.1
              sourceCell: addr,
              sourceRange: table.range,
            });
          }
        }
      }
    }

    return observations;
  }

  // --- Helpers ---

  private groupTreatmentRows(
    rows: Array<{ row: number; col: number; treatment: string }>,
  ): Array<Array<{ row: number; col: number; treatment: string }>> {
    if (rows.length === 0) return [];

    // Sort by row
    const sorted = [...rows].sort((a, b) => a.row - b.row);
    const groups: Array<Array<{ row: number; col: number; treatment: string }>> = [];
    let current = [sorted[0]!];

    for (let i = 1; i < sorted.length; i++) {
      const prev = current[current.length - 1]!;
      const cur = sorted[i]!;
      // Allow gaps of up to 2 rows between treatment rows in the same block
      if (cur.row - prev.row <= 2 && cur.col === prev.col) {
        current.push(cur);
      } else {
        groups.push(current);
        current = [cur];
      }
    }
    groups.push(current);
    return groups;
  }

  private findHeaderRow(
    cells: Map<string, string>,
    blockStartRow: number,
    minCol: number,
    maxCol: number,
  ): number | null {
    // Look 1-3 rows above the block for a row with mostly non-numeric text
    for (let offset = 1; offset <= 3; offset++) {
      const r = blockStartRow - offset;
      if (r < 0) break;

      const row = this.readRow(cells, r, minCol, maxCol);
      const nonEmpty = row.filter(v => v !== '');
      if (nonEmpty.length >= 2 && nonEmpty.some(v => !this.isNumericish(v))) {
        return r;
      }
    }
    return null;
  }

  private readRow(cells: Map<string, string>, row: number, minCol: number, maxCol: number): string[] {
    const result: string[] = [];
    for (let c = minCol; c <= maxCol; c++) {
      const addr = XLSX.utils.encode_cell({ r: row, c });
      result.push(cells.get(addr) ?? '');
    }
    return result;
  }

  private findLabelAbove(
    cells: Map<string, string>,
    startRow: number,
    minRow: number,
    patterns: string[],
  ): string {
    // Scan up to 15 rows above the block for a matching label
    for (let r = startRow - 1; r >= Math.max(minRow, startRow - 15); r--) {
      // Check cells in columns 0-5 (likely label columns)
      for (let c = 0; c <= 5; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const val = cells.get(addr);
        if (val) {
          for (const pattern of patterns) {
            if (val.toLowerCase().includes(pattern.toLowerCase())) {
              return pattern;
            }
          }
        }
      }
    }
    return '';
  }

  private findNearestSectionAbove(
    sections: Array<{ row: number; text: string }>,
    startRow: number,
  ): string {
    let nearest = '';
    let nearestDist = Infinity;
    for (const s of sections) {
      const dist = startRow - s.row;
      if (dist > 0 && dist < nearestDist) {
        nearestDist = dist;
        nearest = s.text;
      }
    }
    return nearest;
  }

  private isTreatmentLabel(val: string): boolean {
    const trimmed = val.trim();
    return TREATMENT_PATTERNS.some(p => trimmed === p);
  }

  private isPlantPartLabel(val: string): boolean {
    return PLANT_PART_PATTERNS.some(p => val.toLowerCase().includes(p.toLowerCase()));
  }

  private isVarietyLabel(val: string): boolean {
    return VARIETY_PATTERNS.some(p => val.toLowerCase().includes(p.toLowerCase()));
  }

  private isNumericish(val: string): boolean {
    // Matches numbers, possibly with ± or decimal
    return /^[+-]?\d+\.?\d*([eE][+-]?\d+)?$/.test(val.trim().replace(/,/g, ''));
  }

  private parseNumber(val: string): number | null {
    const cleaned = val.trim().replace(/,/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  private generateTextSummary(
    profile: WorkbookProfile,
    observations: NormalizedObservation[],
  ): string {
    const lines: string[] = [
      `Excel Workbook: ${profile.fileName}`,
      `Sheets: ${profile.totalSheets}`,
      `Tables detected: ${profile.totalTables}`,
      `Observations extracted: ${observations.length}`,
      '',
      'Sheets:',
    ];

    for (const s of profile.sheets) {
      lines.push(`  - ${s.name}: ${s.rowCount} rows × ${s.colCount} cols (${s.usedRange})`);
      if (s.detectedSections.length > 0) {
        lines.push(`    Sections: ${s.detectedSections.join(', ')}`);
      }
      if (s.detectedTables.length > 0) {
        lines.push(`    Tables: ${s.detectedTables.length}`);
        for (const t of s.detectedTables) {
          const parts = [t.range];
          if (t.plantPart) parts.push(`plantPart=${t.plantPart}`);
          if (t.variety) parts.push(`variety=${t.variety}`);
          if (t.sectionHeader) parts.push(`section="${t.sectionHeader}"`);
          lines.push(`      ${parts.join(', ')}`);
        }
      }
    }

    if (profile.candidateMetrics.length > 0) {
      lines.push('');
      lines.push(`Candidate metrics: ${profile.candidateMetrics.join(', ')}`);
    }

    if (profile.warnings.length > 0) {
      lines.push('');
      lines.push('Warnings:');
      for (const w of profile.warnings) {
        lines.push(`  ⚠️  ${w}`);
      }
    }

    return lines.join('\n');
  }

  private generateId(): string {
    return `src_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private computeHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}
