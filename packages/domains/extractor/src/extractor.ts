import type { Source, Entity, Relationship, SourceReference } from '@contextos/types';
import { getModelForTask, TaskType } from '@contextos/ai';
import { z } from 'zod';
import { RuleBasedExtractor } from './rule-based-extractor.js';

/**
 * Extraction schemas for structured LLM output
 */

const EntitySchema = z.object({
  type: z.enum([
    'actor',
    'system',
    'process',
    'data_store',
    'external_integration',
    'business_entity',
    'endpoint',
    'event'
  ]),
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(0.5),
});

const RelationshipSchema = z.object({
  type: z.enum([
    'uses',
    'calls',
    'stores_in',
    'reads_from',
    'writes_to',
    'integrates_with',
    'triggers',
    'publishes',
    'subscribes_to',
    'contains',
    'depends_on',
    'manages',
    'implements'
  ]),
  sourceEntityName: z.string(),
  targetEntityName: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(0.5),
});

const ExtractionResultSchema = z.object({
  entities: z.array(EntitySchema),
  relationships: z.array(RelationshipSchema),
});

type EntityExtraction = z.infer<typeof EntitySchema>;
type RelationshipExtraction = z.infer<typeof RelationshipSchema>;
type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * EntityExtractor uses LLM to extract entities and relationships from sources
 */
export class EntityExtractor {
  private ruleBasedExtractor = new RuleBasedExtractor();

  /**
   * Extract entities and relationships from a source
   * Uses rule-based extraction first, falls back to LLM for complex cases
   */
  async extract(source: Source, workspaceId: string): Promise<{
    entities: Entity[];
    relationships: Relationship[];
    method: 'rule-based' | 'llm-assisted' | 'hybrid';
    confidence: number;
  }> {
    try {
      // Try rule-based extraction first
      const ruleResult = this.ruleBasedExtractor.extract(
        source.rawContent,
        source.fileType,
        source.fileName
      );

      // If rule-based extraction has good coverage, use it
      if (ruleResult && ruleResult.coverage >= 0.7) {
        const entities = this.convertToEntities(
          ruleResult.entities as EntityExtraction[],
          source,
          workspaceId,
        );
        const relationships = this.convertToRelationships(
          ruleResult.relationships as RelationshipExtraction[],
          entities,
          source,
          workspaceId
        );

        console.log(`[Extractor] Rule-based extraction successful for ${source.fileName} (coverage: ${ruleResult.coverage})`);
        return { 
          entities, 
          relationships,
          method: 'rule-based',
          confidence: ruleResult.coverage,
        };
      }

      // If rule-based extraction has partial coverage, use hybrid approach
      if (ruleResult && ruleResult.coverage >= 0.4) {
        console.log(`[Extractor] Using hybrid approach for ${source.fileName} (rule coverage: ${ruleResult.coverage})`);
        
        const ruleEntities = this.convertToEntities(
          ruleResult.entities as EntityExtraction[],
          source,
          workspaceId,
        );
        const ruleRelationships = this.convertToRelationships(
          ruleResult.relationships as RelationshipExtraction[],
          ruleEntities,
          source,
          workspaceId
        );

        // Supplement with LLM extraction
        const llmResult = await this.extractWithLLM(source);
        const llmEntities = this.convertToEntities(llmResult.entities, source, workspaceId);
        const llmRelationships = this.convertToRelationships(
          llmResult.relationships,
          [...ruleEntities, ...llmEntities],
          source,
          workspaceId
        );

        // Merge results (rule-based takes precedence)
        const mergedEntities = this.mergeEntities(ruleEntities, llmEntities);
        const mergedRelationships = this.mergeRelationships(ruleRelationships, llmRelationships);

        return {
          entities: mergedEntities,
          relationships: mergedRelationships,
          method: 'hybrid',
          confidence: (ruleResult.coverage + 0.7) / 2, // Average of rule coverage and LLM confidence
        };
      }

      // Fall back to LLM-based extraction for complex/ambiguous content
      console.log(`[Extractor] Using LLM extraction for ${source.fileName} (rule coverage too low)`);
      const result = await this.extractWithLLM(source);
      
      const entities = this.convertToEntities(result.entities, source, workspaceId);
      const relationships = this.convertToRelationships(
        result.relationships,
        entities,
        source,
        workspaceId
      );

      return { 
        entities, 
        relationships,
        method: 'llm-assisted',
        confidence: 0.7,
      };
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return { 
        entities: [], 
        relationships: [],
        method: 'llm-assisted',
        confidence: 0,
      };
    }
  }

  /**
   * Merge entities from rule-based and LLM extraction
   * Rule-based entities take precedence for duplicates
   */
  private mergeEntities(ruleEntities: Entity[], llmEntities: Entity[]): Entity[] {
    const merged = [...ruleEntities];
    const existingNames = new Set(ruleEntities.map(e => e.name.toLowerCase()));

    for (const llmEntity of llmEntities) {
      if (!existingNames.has(llmEntity.name.toLowerCase())) {
        merged.push(llmEntity);
        existingNames.add(llmEntity.name.toLowerCase());
      }
    }

    return merged;
  }

  /**
   * Merge relationships from rule-based and LLM extraction
   * Remove duplicates based on source/target/type combination
   */
  private mergeRelationships(ruleRels: Relationship[], llmRels: Relationship[]): Relationship[] {
    const merged = [...ruleRels];
    const existingKeys = new Set(
      ruleRels.map(r => `${r.sourceEntityId}:${r.type}:${r.targetEntityId}`)
    );

    for (const llmRel of llmRels) {
      const key = `${llmRel.sourceEntityId}:${llmRel.type}:${llmRel.targetEntityId}`;
      if (!existingKeys.has(key)) {
        merged.push(llmRel);
        existingKeys.add(key);
      }
    }

    return merged;
  }

  /**
   * Extract using LLM with structured output
   */
  private async extractWithLLM(source: Source): Promise<ExtractionResult> {
    // Get model for extraction task (uses Gemini/Groq with Ollama fallback)
    const model = await getModelForTask(TaskType.EXTRACTION, {
      temperature: 0,
    });

    if (!model) {
      return { entities: [], relationships: [] };
    }

    const prompt = this.buildPrompt(source);

    const result = await model.invoke(prompt);
    const raw = result.content as string;

    // Strip markdown code fences that LLMs often wrap JSON in
    const content = raw.replace(/```(?:json)?\n?|\n?```/g, '').trim();
    
    try {
      const parsed = JSON.parse(content) as ExtractionResult;
      return ExtractionResultSchema.parse(parsed);
    } catch (err) {
      console.warn(`[Extractor] JSON parse/validation failed for ${source.fileName}:`, err instanceof Error ? err.message : err);
      return { entities: [], relationships: [] };
    }
  }

  /**
   * Build extraction prompt based on source category
   */
  private buildPrompt(source: Source): string {
    const basePrompt = `You are an expert system analyst. Extract entities and relationships from this document.

File: ${source.fileName}
Category: ${source.category ?? 'unknown'}

Content:
${source.rawContent.substring(0, 4000)}

Extract the following:

**Entities:**
- actor: Users, customers, admins (people or roles)
- system: Services, databases, APIs (technical systems)
- process: Workflows, business processes
- data_store: Databases, caches, file systems
- external_integration: Third-party services (Stripe, SendGrid, etc.)
- business_entity: Domain model entities (Order, Product, User)
- endpoint: API endpoints
- event: Domain events, messages

**Relationships:**
- uses: actor uses system
- calls: system calls system (API call)
- stores_in: system stores_in data_store
- reads_from: system reads_from data_store
- writes_to: system writes_to data_store
- integrates_with: system integrates_with external_integration
- triggers: event triggers process
- publishes: system publishes event
- subscribes_to: system subscribes_to event
- contains: process contains step
- depends_on: system depends_on system
- manages: system manages business_entity
- implements: system implements endpoint

For each entity, provide:
- type
- name (concise, e.g., "Checkout Service", "Customer")
- description (optional, what it does)
- metadata (type-specific details)
- confidence (0-1, how certain you are)

For each relationship, provide:
- type
- sourceEntityName (must match an entity name)
- targetEntityName (must match an entity name)
- description (optional)
- metadata (additional details)
- confidence (0-1)

Return JSON with this structure:
{
  "entities": [...],
  "relationships": [...]
}

Be precise. Only extract what's explicitly mentioned or strongly implied.

IMPORTANT: Respond with ONLY valid JSON. No markdown formatting, no code fences, no explanation text.`;

    return basePrompt;
  }

  /**
   * Convert LLM extractions to Entity domain objects
   */
  private convertToEntities(
    extractions: EntityExtraction[],
    source: Source,
    workspaceId: string
  ): Entity[] {
    return extractions.map(ext => {
      const sourceRef: SourceReference = {
        sourceId: source.id,
        fileName: source.fileName,
        sourceType: source.fileType,
      };

      return {
        id: this.generateEntityId(ext.name),
        workspaceId,
        type: ext.type,
        name: ext.name,
        description: ext.description,
        metadata: ext.metadata,
        sources: [sourceRef],
        confidence: ext.confidence,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  }

  /**
   * Convert LLM extractions to Relationship domain objects
   */
  private convertToRelationships(
    extractions: RelationshipExtraction[],
    entities: Entity[],
    source: Source,
    workspaceId: string
  ): Relationship[] {
    const relationships: Relationship[] = [];

    for (const ext of extractions) {
      // Find matching entities
      const sourceEntity = entities.find(e => e.name === ext.sourceEntityName);
      const targetEntity = entities.find(e => e.name === ext.targetEntityName);

      if (!sourceEntity || !targetEntity) {
        console.warn(`Could not find entities for relationship: ${ext.sourceEntityName} -> ${ext.targetEntityName}`);
        continue;
      }

      const sourceRef: SourceReference = {
        sourceId: source.id,
        fileName: source.fileName,
        sourceType: source.fileType,
      };

      relationships.push({
        id: this.generateRelationshipId(sourceEntity.id, targetEntity.id, ext.type),
        workspaceId,
        type: ext.type,
        sourceEntityId: sourceEntity.id,
        targetEntityId: targetEntity.id,
        description: ext.description,
        metadata: ext.metadata,
        sources: [sourceRef],
        confidence: ext.confidence,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return relationships;
  }

  private generateEntityId(name: string): string {
    const normalized = name.toLowerCase().replace(/\s+/g, '_');
    return `ent_${normalized}_${Date.now()}`;
  }

  private generateRelationshipId(sourceId: string, targetId: string, type: string): string {
    return `rel_${sourceId}_${type}_${targetId}`;
  }
}
