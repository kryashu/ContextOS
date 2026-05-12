import type { Source } from '@contextos/types';
import { getModelForTask, TaskType } from '@contextos/ai';
import { z } from 'zod';

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
 */
export class SourceClassifier {
  /**
   * Classify a source and determine its category and relevance
   */
  async classify(source: Source): Promise<Source> {
    try {
      // Use rule-based classification first for speed
      const quickClassification = this.quickClassify(source);
      if (quickClassification) {
        return {
          ...source,
          category: quickClassification.category,
          relevanceScore: quickClassification.relevanceScore,
        };
      }

      // Fall back to LLM-based classification for ambiguous cases
      const result = await this.llmClassify(source);
      
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
   * Quick rule-based classification based on file patterns
   */
  private quickClassify(source: Source): ClassificationResult | null {
    const fileName = source.fileName.toLowerCase();
    const content = source.rawContent.toLowerCase();

    // Structured data: xlsx files are analysed via the Excel pipeline
    if (source.fileType === 'xlsx') {
      return {
        category: 'structured_data',
        relevanceScore: 0.7,
        reasoning: 'Structured data file — analysed via Excel pipeline',
      };
    }

    // Database schema patterns
    if (
      fileName.includes('schema') ||
      fileName.includes('database') ||
      source.fileType === 'csv' && content.includes('table_name')
    ) {
      return {
        category: 'database_schema',
        relevanceScore: 0.95,
        reasoning: 'File name or content indicates database schema',
      };
    }

    // Plain CSV without schema indicators — treated as structured data
    if (source.fileType === 'csv') {
      return {
        category: 'structured_data',
        relevanceScore: 0.5,
        reasoning: 'Structured data file — no schema indicators found',
      };
    }

    // API documentation patterns
    if (
      fileName.includes('api') ||
      content.includes('endpoint') ||
      content.includes('post /') ||
      content.includes('get /')
    ) {
      return {
        category: 'api_documentation',
        relevanceScore: 0.95,
        reasoning: 'Contains API endpoint definitions',
      };
    }

    // User flow patterns
    if (
      fileName.includes('flow') ||
      fileName.includes('figma') ||
      source.fileType === 'figma'
    ) {
      return {
        category: 'user_flow',
        relevanceScore: 0.9,
        reasoning: 'Figma file or flow documentation',
      };
    }

    // Requirements patterns
    if (
      fileName.includes('requirement') ||
      fileName.includes('confluence') ||
      source.fileType === 'confluence' ||
      content.includes('business rule')
    ) {
      return {
        category: 'requirements',
        relevanceScore: 0.9,
        reasoning: 'Contains business requirements',
      };
    }

    // Operations patterns
    if (
      fileName.includes('deploy') ||
      fileName.includes('monitor') ||
      fileName.includes('observability')
    ) {
      return {
        category: 'operations',
        relevanceScore: 0.85,
        reasoning: 'Contains operational documentation',
      };
    }

    // Deprecated/outdated patterns
    if (
      fileName.includes('outdated') ||
      fileName.includes('legacy') ||
      fileName.includes('deprecated') ||
      content.includes('deprecated')
    ) {
      return {
        category: 'irrelevant',
        relevanceScore: 0.2,
        reasoning: 'Marked as outdated or deprecated',
      };
    }

    return null; // Needs LLM classification
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
