import type { Source, SourceType } from '@contextos/types';

/**
 * Parser interface - all parsers must implement this
 */
export interface SourceParser {
  /**
   * Check if this parser can handle the given file type
   */
  canParse(fileType: SourceType): boolean;
  
  /**
   * Parse the file content and populate the Source object
   */
  parse(source: Partial<Source>): Promise<Source>;
}

/**
 * ParserResult contains the parsed content and optional structured data
 */
export interface ParserResult {
  rawContent: string;
  structuredData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
