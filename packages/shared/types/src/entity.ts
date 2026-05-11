import type { SourceReference } from './source.js';

/**
 * Entity represents a conceptual element extracted from sources.
 * Entities are the nodes in our knowledge graph.
 */

export type EntityType =
  | 'actor'              // User, Customer, Admin, etc.
  | 'system'             // Service, Database, API, etc.
  | 'process'            // Workflow, Business Process
  | 'data_store'         // Database, Cache, File System
  | 'external_integration' // Third-party service (Stripe, SendGrid)
  | 'business_entity'    // Order, Product, User (domain model)
  | 'endpoint'           // API endpoint
  | 'event';             // Domain event, message

export interface Entity {
  id: string;
  workspaceId: string;
  
  // Core properties
  type: EntityType;
  name: string;
  description?: string;
  
  // Additional metadata (type-specific)
  metadata: Record<string, unknown>;
  
  // Attribution: where was this entity mentioned?
  sources: SourceReference[];
  
  // Confidence score (0-1)
  confidence: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type-specific entity interfaces for better typing
 */

export interface ActorEntity extends Entity {
  type: 'actor';
  metadata: {
    role?: string; // e.g., "Customer", "Admin"
    capabilities?: string[]; // What can this actor do?
  };
}

export interface SystemEntity extends Entity {
  type: 'system';
  metadata: {
    technology?: string; // e.g., "PostgreSQL", "Redis"
    deployment?: string; // e.g., "AWS RDS", "ElastiCache"
    responsibilities?: string[]; // What does this system do?
  };
}

export interface ProcessEntity extends Entity {
  type: 'process';
  metadata: {
    steps?: string[]; // Ordered process steps
    triggers?: string[]; // What starts this process?
    outcomes?: string[]; // What are the results?
  };
}

export interface DataStoreEntity extends Entity {
  type: 'data_store';
  metadata: {
    storeType?: string; // e.g., "relational", "cache", "document"
    technology?: string; // e.g., "PostgreSQL", "Redis"
    schema?: string; // Reference to schema definition
  };
}

export interface ExternalIntegrationEntity extends Entity {
  type: 'external_integration';
  metadata: {
    vendor?: string; // e.g., "Stripe", "SendGrid"
    purpose?: string; // Why do we integrate?
    authMethod?: string; // e.g., "API Key", "OAuth"
  };
}

export interface BusinessEntity extends Entity {
  type: 'business_entity';
  metadata: {
    attributes?: string[]; // Properties of this entity
    lifecycle?: string[]; // States this entity can be in
  };
}

export interface EndpointEntity extends Entity {
  type: 'endpoint';
  metadata: {
    method?: string; // HTTP method
    path?: string; // URL path
    authentication?: boolean;
    rateLimit?: string;
  };
}

export interface EventEntity extends Entity {
  type: 'event';
  metadata: {
    eventType?: string; // e.g., "OrderCreated"
    payload?: Record<string, unknown>; // Event schema
    publisher?: string; // Which system emits this?
    subscribers?: string[]; // Which systems listen?
  };
}
