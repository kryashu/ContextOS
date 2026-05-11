import type { Source, SourceType } from '@contextos/types';
import type { SourceParser } from './types.js';
import { MarkdownParser } from './markdown-parser.js';
import { CSVParser } from './csv-parser.js';
import { JSONParser } from './json-parser.js';
import { ExcelParser } from './excel-parser.js';

/**
 * ParserRegistry manages all parsers and routes to the appropriate one
 */
export class ParserRegistry {
  private parsers: SourceParser[];

  constructor() {
    this.parsers = [
      new MarkdownParser(),
      new CSVParser(),
      new JSONParser(),
      new ExcelParser(),
    ];
  }

  /**
   * Find a parser that can handle the given file type
   */
  getParser(fileType: SourceType): SourceParser {
    const parser = this.parsers.find(p => p.canParse(fileType));
    if (!parser) {
      throw new Error(`No parser found for file type: ${fileType}`);
    }
    return parser;
  }

  /**
   * Parse a source using the appropriate parser
   */
  async parseSource(source: Partial<Source>): Promise<Source> {
    if (!source.fileType) {
      throw new Error('Source must have a fileType');
    }

    const parser = this.getParser(source.fileType);
    return parser.parse(source);
  }

  /**
   * Register a custom parser
   */
  registerParser(parser: SourceParser): void {
    this.parsers.push(parser);
  }
}

/**
 * Default singleton instance
 */
export const parserRegistry = new ParserRegistry();
