/**
 * Workspace Q&A types — VS006.
 * Source-grounded question answering over workspace artifacts.
 */

export type WorkspaceQuestionIntent =
  | 'about'            // What is this workspace about?
  | 'irrelevant_files' // Which files are irrelevant?
  | 'capabilities'     // What calculations / actions are possible?
  | 'sheet_query'      // Which sheets are related to X?
  | 'document_fact'    // Factual question answered from document content
  | 'unknown';         // Could not classify

export type WorkspaceAnswerArtifactType =
  | 'workspace-context'
  | 'source-profiles'
  | 'workbook-profile'
  | 'normalized-observations'
  | 'source-file';

export interface WorkspaceAnswerSourceRef {
  fileName: string;
  snippet?: string;
  artifactType: WorkspaceAnswerArtifactType;
}

export interface WorkspaceAnswer {
  question: string;
  intent: WorkspaceQuestionIntent;
  answer: string;
  sourceRefs: WorkspaceAnswerSourceRef[];
  confidence: number; // 0–1
  timestamp: string;
  warnings: string[];
}
