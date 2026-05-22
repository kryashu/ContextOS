/**
 * Rule-Based Entity Extractor
 * 
 * Provides deterministic entity and relationship extraction for structured formats
 * without requiring LLM usage. Handles:
 * - JSON/YAML structured data
 * - API endpoint patterns
 * - Database schema patterns
 * - Common entity naming conventions
 */

import type { Entity, Relationship, SourceReference } from '@contextos/types';
import { calculateConfidence } from '@contextos/validation';

export interface RuleBasedExtractionResult {
  entities: Array<{
    type: string;
    name: string;
    description?: string;
    metadata: Record<string, unknown>;
    confidence: number;
  }>;
  relationships: Array<{
    type: string;
    sourceEntityName: string;
    targetEntityName: string;
    description?: string;
    metadata: Record<string, unknown>;
    confidence: number;
  }>;
  coverage: number; // 0-1, how much of the content was successfully parsed
}

/**
 * RuleBasedExtractor provides deterministic extraction for structured formats
 */
export class RuleBasedExtractor {
  /**
   * Attempt rule-based extraction from source content
   * Returns null if content cannot be parsed with rules
   */
  extract(content: string, fileType: string, fileName: string): RuleBasedExtractionResult | null {
    // Try format-specific extractors
    if (fileType === 'json') {
      return this.extractFromJSON(content, fileName);
    }
    if (fileType === 'yaml' || fileType === 'yml') {
      return this.extractFromYAML(content, fileName);
    }
    if (fileType === 'md' || fileType === 'markdown') {
      return this.extractFromMarkdown(content, fileName);
    }
    if (fileType === 'sql') {
      return this.extractFromSQL(content, fileName);
    }

    // Try pattern-based extraction for any text content
    return this.extractFromPatterns(content, fileName);
  }

  /**
   * Extract entities and relationships from JSON content
   */
  private extractFromJSON(content: string, fileName: string): RuleBasedExtractionResult | null {
    try {
      const data = JSON.parse(content);
      const entities: RuleBasedExtractionResult['entities'] = [];
      const relationships: RuleBasedExtractionResult['relationships'] = [];

      // Extract from OpenAPI/Swagger spec
      if (data.openapi || data.swagger) {
        return this.extractFromOpenAPI(data, fileName);
      }

      // Extract from package.json
      if (data.name && data.dependencies) {
        return this.extractFromPackageJSON(data, fileName);
      }

      // Generic JSON object extraction
      this.extractEntitiesFromObject(data, '', entities, relationships);

      return {
        entities,
        relationships,
        coverage: entities.length > 0 ? 0.8 : 0.3,
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract from OpenAPI/Swagger specification
   */
  private extractFromOpenAPI(spec: Record<string, unknown>, fileName: string): RuleBasedExtractionResult {
    const entities: RuleBasedExtractionResult['entities'] = [];
    const relationships: RuleBasedExtractionResult['relationships'] = [];

    // Extract API service entity
    const serviceName = (spec.info as Record<string, unknown>)?.title as string ?? 'API Service';
    entities.push({
      type: 'system',
      name: serviceName,
      description: (spec.info as Record<string, unknown>)?.description as string,
      metadata: { source: fileName, apiVersion: spec.openapi ?? spec.swagger },
      confidence: 1.0,
    });

    // Extract endpoints
    const paths = spec.paths as Record<string, Record<string, unknown>> ?? {};
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, details] of Object.entries(methods)) {
        if (typeof details !== 'object' || details === null) continue;
        
        const endpointName = `${method.toUpperCase()} ${path}`;
        entities.push({
          type: 'endpoint',
          name: endpointName,
          description: (details as Record<string, unknown>).summary as string ?? (details as Record<string, unknown>).description as string,
          metadata: { method, path, operationId: (details as Record<string, unknown>).operationId },
          confidence: 1.0,
        });

        // Relationship: service implements endpoint
        relationships.push({
          type: 'implements',
          sourceEntityName: serviceName,
          targetEntityName: endpointName,
          description: `${serviceName} implements ${endpointName}`,
          metadata: {},
          confidence: 1.0,
        });
      }
    }

    return { entities, relationships, coverage: 1.0 };
  }

  /**
   * Extract from package.json
   */
  private extractFromPackageJSON(pkg: Record<string, unknown>, fileName: string): RuleBasedExtractionResult {
    const entities: RuleBasedExtractionResult['entities'] = [];
    const relationships: RuleBasedExtractionResult['relationships'] = [];

    // Main package entity
    const pkgName = pkg.name as string;
    entities.push({
      type: 'system',
      name: pkgName,
      description: pkg.description as string,
      metadata: { version: pkg.version, source: fileName },
      confidence: 1.0,
    });

    // Dependencies as external integrations
    const deps = pkg.dependencies as Record<string, string> ?? {};
    for (const [depName, version] of Object.entries(deps)) {
      entities.push({
        type: 'external_integration',
        name: depName,
        description: `External dependency: ${depName}@${version}`,
        metadata: { version },
        confidence: 1.0,
      });

      relationships.push({
        type: 'depends_on',
        sourceEntityName: pkgName,
        targetEntityName: depName,
        description: `${pkgName} depends on ${depName}`,
        metadata: { version },
        confidence: 1.0,
      });
    }

    return { entities, relationships, coverage: 1.0 };
  }

  /**
   * Recursively extract entities from nested JSON objects
   */
  private extractEntitiesFromObject(
    obj: unknown,
    path: string,
    entities: RuleBasedExtractionResult['entities'],
    relationships: RuleBasedExtractionResult['relationships'],
    maxDepth = 3,
  ): void {
    if (maxDepth <= 0 || typeof obj !== 'object' || obj === null) return;

    const record = obj as Record<string, unknown>;

    // Look for entity-like structures
    if (record.id && record.name) {
      entities.push({
        type: 'business_entity',
        name: String(record.name),
        description: record.description as string,
        metadata: { id: record.id, path },
        confidence: 0.7,
      });
    }

    // Recurse into nested objects
    for (const [key, value] of Object.entries(record)) {
      const newPath = path ? `${path}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        this.extractEntitiesFromObject(value, newPath, entities, relationships, maxDepth - 1);
      }
    }
  }

  /**
   * Extract from YAML content
   */
  private extractFromYAML(content: string, fileName: string): RuleBasedExtractionResult | null {
    // Simple YAML parsing (for basic cases, full YAML would need a library)
    // This is a simplified implementation for demonstration
    try {
      // Convert simple YAML to JSON-like structure
      const lines = content.split('\n');
      const entities: RuleBasedExtractionResult['entities'] = [];
      const relationships: RuleBasedExtractionResult['relationships'] = [];

      // Look for service/deployment definitions
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim() ?? '';
        
        // Kubernetes-style service definitions
        if (line.startsWith('kind:')) {
          const kind = line.split(':')[1]?.trim();
          const nameLine = lines[i + 1]?.trim() ?? '';
          if (nameLine.startsWith('name:')) {
            const name = nameLine.split(':')[1]?.trim();
            if (name && kind) {
              entities.push({
                type: kind === 'Service' ? 'system' : 'process',
                name,
                description: `Kubernetes ${kind}: ${name}`,
                metadata: { kind, source: fileName },
                confidence: 0.9,
              });
            }
          }
        }
      }

      return entities.length > 0 ? { entities, relationships, coverage: 0.7 } : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract from Markdown content
   */
  private extractFromMarkdown(content: string, fileName: string): RuleBasedExtractionResult | null {
    const entities: RuleBasedExtractionResult['entities'] = [];
    const relationships: RuleBasedExtractionResult['relationships'] = [];

    // Extract API endpoints from markdown
    const endpointPattern = /^#+\s*(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s]+)/gim;
    let match;
    while ((match = endpointPattern.exec(content)) !== null) {
      const method = match[1];
      const path = match[2];
      entities.push({
        type: 'endpoint',
        name: `${method} ${path}`,
        description: `API endpoint: ${method} ${path}`,
        metadata: { method, path, source: fileName },
        confidence: 0.9,
      });
    }

    // Extract system/service names from headers
    const headerPattern = /^#+\s+([A-Z][\w\s]+(?:Service|System|API|Database))/gim;
    while ((match = headerPattern.exec(content)) !== null) {
      const name = match[1]?.trim();
      if (name) {
        entities.push({
          type: 'system',
          name,
          description: `System component: ${name}`,
          metadata: { source: fileName },
          confidence: 0.7,
        });
      }
    }

    return entities.length > 0 ? { entities, relationships, coverage: 0.6 } : null;
  }

  /**
   * Extract from SQL content
   */
  private extractFromSQL(content: string, fileName: string): RuleBasedExtractionResult | null {
    const entities: RuleBasedExtractionResult['entities'] = [];
    const relationships: RuleBasedExtractionResult['relationships'] = [];

    // Extract table definitions
    const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)\s*\(/gi;
    let match;
    while ((match = tablePattern.exec(content)) !== null) {
      const tableName = match[1];
      if (tableName) {
        entities.push({
          type: 'data_store',
          name: tableName,
          description: `Database table: ${tableName}`,
          metadata: { source: fileName, type: 'table' },
          confidence: 1.0,
        });
      }
    }

    // Extract foreign key relationships
    const fkPattern = /FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+([\w.]+)/gi;
    while ((match = fkPattern.exec(content)) !== null) {
      const referencedTable = match[1];
      if (referencedTable) {
        // Find the table this FK belongs to (look backwards in content)
        const beforeFK = content.substring(0, match.index);
        const tableMatch = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)\s*\(/gi.exec(beforeFK);
        if (tableMatch && tableMatch[1]) {
          relationships.push({
            type: 'reads_from',
            sourceEntityName: tableMatch[1],
            targetEntityName: referencedTable,
            description: `${tableMatch[1]} references ${referencedTable}`,
            metadata: { type: 'foreign_key' },
            confidence: 1.0,
          });
        }
      }
    }

    return entities.length > 0 ? { entities, relationships, coverage: 0.9 } : null;
  }

  /**
   * Extract using pattern matching for any text content
   */
  private extractFromPatterns(content: string, fileName: string): RuleBasedExtractionResult | null {
    const entities: RuleBasedExtractionResult['entities'] = [];
    const relationships: RuleBasedExtractionResult['relationships'] = [];

    // API endpoint patterns
    const apiPattern = /(GET|POST|PUT|DELETE|PATCH)\s+(\/[\w\-\/{}:]+)/gi;
    let match;
    while ((match = apiPattern.exec(content)) !== null) {
      const method = match[1];
      const path = match[2];
      entities.push({
        type: 'endpoint',
        name: `${method} ${path}`,
        description: `API endpoint: ${method} ${path}`,
        metadata: { method, path, source: fileName },
        confidence: 0.85,
      });
    }

    // Database table patterns
    const tablePattern = /(?:table|TABLE)\s+[`'"]?([\w_]+)[`'"]?/g;
    while ((match = tablePattern.exec(content)) !== null) {
      const tableName = match[1];
      if (tableName && tableName.length > 2) {
        entities.push({
          type: 'data_store',
          name: tableName,
          description: `Database table: ${tableName}`,
          metadata: { source: fileName },
          confidence: 0.6,
        });
      }
    }

    // Service/System name patterns (PascalCase or Service suffix)
    const servicePattern = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)*(?:Service|System|API|Client|Handler|Controller))\b/g;
    const foundServices = new Set<string>();
    while ((match = servicePattern.exec(content)) !== null) {
      const serviceName = match[1];
      if (serviceName && !foundServices.has(serviceName)) {
        foundServices.add(serviceName);
        entities.push({
          type: 'system',
          name: serviceName,
          description: `System component: ${serviceName}`,
          metadata: { source: fileName },
          confidence: 0.7,
        });
      }
    }

    return entities.length > 0 ? { entities, relationships, coverage: 0.5 } : null;
  }
}
