/**
 * Source represents a raw document or file ingested into the system.
 * Every piece of information comes from a Source.
 */

export type SourceType = 
  | 'markdown'
  | 'csv'
  | 'json'
  | 'xlsx'
  | 'pdf'
  | 'docx'
  | 'text'
  | 'yaml'
  | 'confluence'
  | 'figma'
  | 'unknown';

export type SourceStatus = 
  | 'pending'    // Awaiting processing
  | 'processing' // Currently being ingested
  | 'completed'  // Successfully processed
  | 'failed';    // Processing failed

export interface Source {
  id: string;
  workspaceId: string;
  
  // File metadata
  fileName: string;
  filePath: string;
  fileType: SourceType;
  fileSize: number; // bytes
  fileHash: string; // For duplicate detection
  
  // Content
  rawContent: string;
  structuredData?: Record<string, unknown>; // For CSV, JSON, etc.
  
  // Processing
  status: SourceStatus;
  parsedAt?: Date;
  errorMessage?: string;
  
  // Classification (populated after classification step)
  category?: SourceCategory;
  relevanceScore?: number; // 0-1, how relevant to workspace
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type SourceCategory =
  | 'architecture'       // Architecture diagrams, system designs
  | 'api_documentation'  // API specs, endpoint docs
  | 'database_schema'    // Database structures, ERDs
  | 'requirements'       // Business requirements, user stories
  | 'user_flow'          // UX flows, wireframes
  | 'operations'         // Deployment, monitoring, runbooks
  | 'code'              // Source code, snippets
  | 'meeting_notes'     // Meeting minutes, discussions
  | 'structured_data'   // Spreadsheets, CSV data, tables
  | 'irrelevant'        // Not relevant to technical understanding
  | 'unknown';          // Not yet classified

/**
 * SourceReference points to a specific location within a Source.
 * Used for attribution and traceability.
 */
export interface SourceReference {
  sourceId: string;
  fileName: string;
  sourceType?: string; // e.g., 'markdown', 'csv', 'json'
  
  // Optional precise location
  startLine?: number;
  endLine?: number;
  section?: string; // e.g., "## API Endpoints"
  
  // Excerpt for context
  excerpt?: string; // Relevant snippet from source
}
