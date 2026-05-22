import type { Source } from '@contextos/types';
import { getModelForTask, TaskType } from '@contextos/ai';
import { z } from 'zod';
import { calculateConfidence, LRUCache, OptimizedPatternMatcher } from './internal-utils.js';

/**
 * Classification result schema
 */
const ClassificationResultSchema = z.object({
  category: z.enum([
    'architecture',
    'api_documentation',
    'database_schema',
    'requirements',
    'user_flow',
    'operations',
    'code',
    'meeting_notes',
    'structured_data',
    'irrelevant',
    'unknown'
  ]),
  relevanceScore: z.number().min(0).max(1),
  reasoning: z.string(),
});

type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

/**
 * SourceClassifier categorizes sources and scores their relevance
 * Enhanced with performance optimizations: caching and indexed pattern matching
 */
export class SourceClassifier {
  private classificationCache = new LRUCache<string, ClassificationResult>(500, 10 * 60 * 1000); // 10 min TTL
  private patternMatcher = new OptimizedPatternMatcher(1000);
  private initialized = false;

  constructor() {
    this.initializePatternMatcher();
  }

  /**
   * Initialize optimized pattern matcher with all classification patterns
   */
  private initializePatternMatcher(): void {
    if (this.initialized) return;

    // Register patterns with priorities and keywords for fast lookup
    this.patternMatcher.registerPattern(
      'structured_data_xlsx',
      /\.xlsx$/i,
      100,
      ['xlsx', 'excel', 'spreadsheet']
    );

    this.patternMatcher.registerPattern(
      'database_schema',
      /schema|database|table_name|column_name|erd|ddl/i,
      95,
      ['schema', 'database', 'table', 'erd', 'ddl']
    );

    this.patternMatcher.registerPattern(
      'api_documentation',
      /api|endpoint|rest|graphql|openapi|swagger|post\s*\/|get\s*\//i,
      95,
      ['api', 'endpoint', 'rest', 'graphql', 'openapi', 'swagger']
    );

    this.patternMatcher.registerPattern(
      'architecture',
      /architecture|design|diagram|component|system\s+design|c4\s+model/i,
      90,
      ['architecture', 'design', 'diagram', 'component']
    );

    this.patternMatcher.registerPattern(
      'user_flow',
      /flow|figma|wireframe|mockup|user\s+journey|ux|ui/i,
      90,
      ['flow', 'figma', 'wireframe', 'mockup', 'ux', 'ui']
    );

    this.patternMatcher.registerPattern(
      'requirements',
      /requirement|confluence|spec|specification|business\s+rule|user\s+story/i,
      90,
      ['requirement', 'confluence', 'spec', 'specification']
    );

    this.patternMatcher.registerPattern(
      'operations',
      /deploy|deployment|monitor|monitoring|observability|runbook|infrastructure|devops/i,
      85,
      ['deploy', 'monitor', 'observability', 'runbook', 'infrastructure']
    );

    this.patternMatcher.registerPattern(
      'code',
      /function|class|import|export|const|let|var|def|public|private/i,
      85,
      ['function', 'class', 'import', 'export']
    );

    this.patternMatcher.registerPattern(
      'meeting_notes',
      /meeting|minutes|notes|agenda|action\s+items|attendees/i,
      80,
      ['meeting', 'minutes', 'notes', 'agenda']
    );

    this.patternMatcher.registerPattern(
      'deprecated',
      /outdated|legacy|deprecated|obsolete|archived|do\s+not\s+use/i,
      95,
      ['outdated', 'legacy', 'deprecated', 'obsolete', 'archived']
    );

    this.initialized = true;
  }
  /**
   * Classify a source and determine its category and relevance
   * Uses caching for performance optimization
   */
  async classify(source: Source): Promise<Source> {
    try {
      // Check cache first (performance optimization)
      const cacheKey = `${source.fileName}:${source.fileType}:${source.rawContent.substring(0, 100)}`;
      const cached = this.classificationCache.get(cacheKey);
      if (cached) {
        return {
          ...source,
          category: cached.category,
          relevanceScore: cached.relevanceScore,
        };
      }

      // Use rule-based classification first for speed
      const quickClassification = this.quickClassify(source);
      if (quickClassification) {
        // Cache the result
        this.classificationCache.set(cacheKey, quickClassification);
        
        return {
          ...source,
          category: quickClassification.category,
          relevanceScore: quickClassification.relevanceScore,
        };
      }

      // Fall back to LLM-based classification for ambiguous cases
      const result = await this.llmClassify(source);
      
      // Cache the result
      this.classificationCache.set(cacheKey, result);
      
      return {
        ...source,
        category: result.category,
        relevanceScore: result.relevanceScore,
      };
    } catch (error) {
      console.error('Classification failed:', error);
      return {
        ...source,
        category: 'unknown',
        relevanceScore: 0.5,
      };
    }
  }

  /**
   * Get classification cache statistics
   */
  getCacheStats() {
    return {
      classification: this.classificationCache.getStats(),
      patternMatcher: this.patternMatcher.getCacheStats(),
    };
  }

  /**
   * Quick rule-based classification based on file patterns
   * Enhanced with stricter validation and confidence scoring
   */
  private quickClassify(source: Source): ClassificationResult | null {
    const fileName = source.fileName.toLowerCase();
    const content = source.rawContent.toLowerCase();
    const fileExt = source.fileType.toLowerCase();

    // Validate file type
    if (!this.isValidFileType(fileExt)) {
      return {
        category: 'unknown',
        relevanceScore: 0.3,
        reasoning: `Unsupported file type: ${fileExt}`,
      };
    }

    // Enhanced pattern matching with confidence scoring
    const patterns: Array<{
      condition: boolean;
      category: ClassificationResult['category'];
      baseConfidence: number;
      reasoning: string;
      keywords?: string[];
    }> = [
      // Structured data patterns
      {
        condition: fileExt === 'xlsx',
        category: 'structured_data',
        baseConfidence: 0.95,
        reasoning: 'Excel workbook — analysed via Excel pipeline',
      },
      {
        condition: fileExt === 'csv' && this.hasSchemaIndicators(fileName, content),
        category: 'database_schema',
        baseConfidence: 0.95,
        reasoning: 'CSV with database schema indicators',
        keywords: ['schema', 'database', 'table_name', 'column_name', 'data_type'],
      },
      {
        condition: fileExt === 'csv',
        category: 'structured_data',
        baseConfidence: 0.7,
        reasoning: 'CSV file — structured data',
      },
      // Architecture patterns
      {
        condition: this.hasArchitectureIndicators(fileName, content),
        category: 'architecture',
        baseConfidence: 0.9,
        reasoning: 'Contains architecture or design documentation',
        keywords: ['architecture', 'design', 'diagram', 'component', 'system design', 'c4 model'],
      },
      // Database schema patterns (enhanced)
      {
        condition: this.hasDatabaseSchemaIndicators(fileName, content),
        category: 'database_schema',
        baseConfidence: 0.95,
        reasoning: 'Contains database schema definitions',
        keywords: ['schema', 'database', 'table', 'erd', 'entity relationship', 'ddl', 'create table'],
      },
      // API documentation patterns (enhanced)
      {
        condition: this.hasAPIIndicators(fileName, content),
        category: 'api_documentation',
        baseConfidence: 0.95,
        reasoning: 'Contains API endpoint definitions',
        keywords: ['api', 'endpoint', 'rest', 'graphql', 'openapi', 'swagger', 'post /', 'get /', 'put /', 'delete /'],
      },
      // User flow patterns (enhanced)
      {
        condition: this.hasUserFlowIndicators(fileName, content, fileExt),
        category: 'user_flow',
        baseConfidence: 0.9,
        reasoning: 'Contains user flow or UX documentation',
        keywords: ['flow', 'figma', 'wireframe', 'mockup', 'user journey', 'ux', 'ui'],
      },
      // Requirements patterns (enhanced)
      {
        condition: this.hasRequirementsIndicators(fileName, content, fileExt),
        category: 'requirements',
        baseConfidence: 0.9,
        reasoning: 'Contains business requirements',
        keywords: ['requirement', 'confluence', 'spec', 'specification', 'business rule', 'user story', 'acceptance criteria'],
      },
      // Operations patterns (enhanced)
      {
        condition: this.hasOperationsIndicators(fileName, content),
        category: 'operations',
        baseConfidence: 0.85,
        reasoning: 'Contains operational documentation',
        keywords: ['deploy', 'deployment', 'monitor', 'monitoring', 'observability', 'runbook', 'ops', 'infrastructure', 'devops'],
      },
      // Code patterns (new)
      {
        condition: this.hasCodeIndicators(fileName, content, fileExt),
        category: 'code',
        baseConfidence: 0.85,
        reasoning: 'Contains source code',
        keywords: ['function', 'class', 'import', 'export', 'const', 'let', 'var', 'def', 'public', 'private'],
      },
      // Meeting notes patterns (new)
      {
        condition: this.hasMeetingNotesIndicators(fileName, content),
        category: 'meeting_notes',
        baseConfidence: 0.8,
        reasoning: 'Contains meeting notes or minutes',
        keywords: ['meeting', 'minutes', 'notes', 'agenda', 'action items', 'attendees', 'discussion'],
      },
      // Deprecated/outdated patterns (enhanced)
      {
        condition: this.hasDeprecatedIndicators(fileName, content),
        category: 'irrelevant',
        baseConfidence: 0.95,
        reasoning: 'Marked as outdated, deprecated, or legacy',
        keywords: ['outdated', 'legacy', 'deprecated', 'obsolete', 'archived', 'old', 'do not use'],
      },
    ];

    // Find first matching pattern
    for (const pattern of patterns) {
      if (pattern.condition) {
        // Calculate confidence based on keyword matches
        let confidence = pattern.baseConfidence;
        if (pattern.keywords) {
          const matchCount = pattern.keywords.filter(kw => 
            fileName.includes(kw) || content.includes(kw)
          ).length;
          const matchRatio = matchCount / pattern.keywords.length;
          confidence = calculateConfidence({
            exactMatch: pattern.baseConfidence,
            patternMatch: matchRatio * 0.9,
          });
        }

        return {
          category: pattern.category,
          relevanceScore: confidence,
          reasoning: pattern.reasoning,
        };
      }
    }

    return null; // Needs LLM classification
  }

  /**
   * Validate file type against supported types
   */
  private isValidFileType(fileType: string): boolean {
    const validTypes = new Set([
      'pdf', 'docx', 'doc', 'txt', 'md', 'markdown',
      'xlsx', 'xls', 'csv',
      'json', 'yaml', 'yml',
      'figma', 'confluence',
      'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rb', 'php',
      'html', 'css', 'scss', 'sass',
      'xml', 'sql',
    ]);
    return validTypes.has(fileType);
  }

  /**
   * Check for schema indicators in CSV files
   */
  private hasSchemaIndicators(fileName: string, content: string): boolean {
    const schemaKeywords = ['schema', 'database', 'table_name', 'column_name', 'data_type', 'constraint'];
    return schemaKeywords.some(kw => fileName.includes(kw) || content.includes(kw));
  }

  /**
   * Check for architecture indicators
   */
  private hasArchitectureIndicators(fileName: string, content: string): boolean {
    const keywords = ['architecture', 'design', 'diagram', 'component', 'system design', 'c4 model', 'adr', 'decision'];
    return keywords.some(kw => fileName.includes(kw) || content.includes(kw));
  }

  /**
   * Check for database schema indicators
   */
  private hasDatabaseSchemaIndicators(fileName: string, content: string): boolean {
    const keywords = ['schema', 'database', 'table', 'erd', 'entity relationship', 'ddl', 'create table'];
    return keywords.some(kw => fileName.includes(kw) || content.includes(kw));
  }

  /**
   * Check for API indicators
   */
  private hasAPIIndicators(fileName: string, content: string): boolean {
    const keywords = ['api', 'endpoint', 'rest', 'graphql', 'openapi', 'swagger'];
    const httpMethods = ['post /', 'get /', 'put /', 'delete /', 'patch /'];
    return keywords.some(kw => fileName.includes(kw) || content.includes(kw)) ||
           httpMethods.some(method => content.includes(method));
  }

  /**
   * Check for user flow indicators
   */
  private hasUserFlowIndicators(fileName: string, content: string, fileType: string): boolean {
    const keywords = ['flow', 'wireframe', 'mockup', 'user journey', 'ux', 'ui'];
    return fileType === 'figma' || keywords.some(kw => fileName.includes(kw) || content.includes(kw));
  }

  /**
   * Check for requirements indicators
   */
  private hasRequirementsIndicators(fileName: string, content: string, fileType: string): boolean {
    const keywords = ['requirement', 'spec', 'specification', 'business rule', 'user story', 'acceptance criteria'];
    return fileType === 'confluence' || keywords.some(kw => fileName.includes(kw) || content.includes(kw));
  }

  /**
   * Check for operations indicators
   */
  private hasOperationsIndicators(fileName: string, content: string): boolean {
    const keywords = ['deploy', 'deployment', 'monitor', 'monitoring', 'observability', 'runbook', 'ops', 'infrastructure', 'devops'];
    return keywords.some(kw => fileName.includes(kw) || content.includes(kw));
  }

  /**
   * Check for code indicators
   */
  private hasCodeIndicators(_fileName: string, content: string, fileType: string): boolean {
    const codeExtensions = new Set(['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rb', 'php', 'html', 'css', 'scss']);
    const codeKeywords = ['function', 'class', 'import', 'export', 'const', 'let', 'var', 'def', 'public', 'private'];
    return codeExtensions.has(fileType) || codeKeywords.some(kw => content.includes(kw));
  }

  /**
   * Check for meeting notes indicators
   */
  private hasMeetingNotesIndicators(fileName: string, content: string): boolean {
    const keywords = ['meeting', 'minutes', 'notes', 'agenda', 'action items', 'attendees', 'discussion'];
    return keywords.some(kw => fileName.includes(kw) || content.includes(kw));
  }

  /**
   * Check for deprecated indicators
   */
  private hasDeprecatedIndicators(fileName: string, content: string): boolean {
    const keywords = ['outdated', 'legacy', 'deprecated', 'obsolete', 'archived', 'old', 'do not use'];
    return keywords.some(kw => fileName.includes(kw) || content.includes(kw));
  }

  /**
   * LLM-based classification for ambiguous cases
   */
  private async llmClassify(source: Source): Promise<ClassificationResult> {
    // Get model for classification task (uses Ollama llama3.2:3b if available)
    const model = await getModelForTask(TaskType.CLASSIFICATION, {
      temperature: 0.1,
    });

    if (!model) {
      return {
        category: 'unknown',
        relevanceScore: 0.5,
        reasoning: 'No LLM provider available for classification',
      };
    }

    const prompt = `You are a technical documentation classifier. Analyze this document and classify it.

File: ${source.fileName}
Type: ${source.fileType}

Content (first 500 chars):
${source.rawContent.substring(0, 500)}

Classify this document into one of these categories:
- architecture: System architecture, design diagrams, architectural decisions
- api_documentation: API specifications, endpoint documentation
- database_schema: Database schemas, table definitions, ERDs
- requirements: Business requirements, functional specs, user stories
- user_flow: User flows, wireframes, UX designs
- operations: Deployment, monitoring, runbooks, infrastructure
- code: Source code, code snippets
- meeting_notes: Meeting minutes, discussions, notes
- irrelevant: Not relevant to technical system understanding
- unknown: Cannot determine category

Also provide a relevance score (0-1) indicating how useful this document is for understanding the technical system.

Provide your response as JSON.`;

    const result = await model.invoke(prompt);
    const content = result.content as string;
    
    try {
      const parsed = JSON.parse(content) as ClassificationResult;
      return ClassificationResultSchema.parse(parsed);
    } catch {
      // Fallback if JSON parsing fails
      return {
        category: 'unknown',
        relevanceScore: 0.5,
        reasoning: 'Could not parse LLM response',
      };
    }
  }

  /**
   * Batch classify multiple sources
   */
  async classifyBatch(sources: Source[]): Promise<Source[]> {
    const results = await Promise.all(
      sources.map(source => this.classify(source))
    );
    return results;
  }
}
