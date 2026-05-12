import { FakeListChatModel } from '@langchain/core/utils/testing';
import type { ModelOptions } from '../model-factory.js';

/** Deterministic mock responses keyed by task type */
const MOCK_RESPONSES: Record<string, string> = {
  classification: JSON.stringify({
    category: 'api_documentation',
    relevanceScore: 0.95,
    reasoning: 'Mock classification result for testing',
  }),

  extraction: JSON.stringify({
    entities: [
      { type: 'actor',    name: 'User',               description: 'End-user interacting with the system', metadata: {}, confidence: 0.95 },
      { type: 'system',   name: 'Data Processor',      description: 'Handles data processing pipeline',     metadata: {}, confidence: 0.95 },
      { type: 'system',   name: 'Storage Service',     description: 'Manages data persistence',             metadata: {}, confidence: 0.9  },
      { type: 'system',   name: 'Analytics Engine',    description: 'Computes analytics and metrics',       metadata: {}, confidence: 0.9  },
      { type: 'system',   name: 'Notification Service', description: 'Sends notifications',                 metadata: {}, confidence: 0.85 },
      { type: 'data_store', name: 'Application Database', description: 'Persists application data',         metadata: {}, confidence: 0.9  },
      { type: 'external_integration', name: 'External API', description: 'Third-party API integration',     metadata: {}, confidence: 0.95 },
      { type: 'endpoint', name: 'POST /api/process',   description: 'Data processing API endpoint',         metadata: {}, confidence: 0.9  },
    ],
    relationships: [
      { type: 'uses',            sourceEntityName: 'User',              targetEntityName: 'Data Processor',      description: 'Submits data',          metadata: {}, confidence: 0.95 },
      { type: 'calls',           sourceEntityName: 'Data Processor',    targetEntityName: 'Storage Service',     description: 'Persists results',      metadata: {}, confidence: 0.9  },
      { type: 'calls',           sourceEntityName: 'Data Processor',    targetEntityName: 'Analytics Engine',    description: 'Requests analysis',     metadata: {}, confidence: 0.9  },
      { type: 'integrates_with', sourceEntityName: 'Data Processor',    targetEntityName: 'External API',        description: 'Fetches external data', metadata: {}, confidence: 0.9  },
      { type: 'stores_in',       sourceEntityName: 'Storage Service',   targetEntityName: 'Application Database', description: 'Writes records',       metadata: {}, confidence: 0.9  },
      { type: 'calls',           sourceEntityName: 'Analytics Engine',  targetEntityName: 'Notification Service', description: 'Sends alerts',         metadata: {}, confidence: 0.85 },
      { type: 'implements',      sourceEntityName: 'Data Processor',    targetEntityName: 'POST /api/process',   description: 'Serves endpoint',       metadata: {}, confidence: 0.9  },
    ],
  }),

  summarization: JSON.stringify({
    summary: 'Mock workspace summary for testing purposes.',
  }),

  relationship_mapping: JSON.stringify({
    entities: [
      { type: 'system', name: 'Service A', description: 'Mock service', metadata: {}, confidence: 0.9 },
      { type: 'system', name: 'Service B', description: 'Mock service', metadata: {}, confidence: 0.9 },
    ],
    relationships: [
      { type: 'calls', sourceEntityName: 'Service A', targetEntityName: 'Service B', description: 'Mock call', metadata: {}, confidence: 0.9 },
    ],
  }),

  artifact_generation: [
    'flowchart TB',
    '    User[["User"]]',
    '    DataProcessor("Data Processor")',
    '    StorageService("Storage Service")',
    '    ExternalAPI[["External API"]]',
    '    User --> |"submits data"| DataProcessor',
    '    DataProcessor --> |"persists results"| StorageService',
    '    DataProcessor --> |"fetches"| ExternalAPI',
  ].join('\n'),

  // Default / health-check
  default: JSON.stringify({
    status: 'working',
    message: 'Mock provider is operational',
  }),

  qa: 'Based on the provided source materials, the workspace contains documentation and structured data related to the analysed domain.',
};

/**
 * Create a test model instance for deterministic testing.
 * Preferred over createMockModel — same behaviour, clearer intent.
 */
export function createTestModel(options: ModelOptions = {}): FakeListChatModel {
  const taskType = options.taskType ?? 'default';
  const response = MOCK_RESPONSES[taskType] ?? MOCK_RESPONSES['default']!;

  return new FakeListChatModel({
    responses: [response],
  });
}

/**
 * @deprecated Use createTestModel instead.
 */
export function createMockModel(options: ModelOptions = {}): FakeListChatModel {
  return createTestModel(options);
}
