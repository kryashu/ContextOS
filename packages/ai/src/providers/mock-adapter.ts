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
      { type: 'actor',    name: 'Customer',           description: 'End-user placing orders',       metadata: {}, confidence: 0.95 },
      { type: 'system',   name: 'Checkout Service',    description: 'Handles checkout flow',         metadata: {}, confidence: 0.95 },
      { type: 'system',   name: 'Payment Service',     description: 'Processes payments',            metadata: {}, confidence: 0.9  },
      { type: 'system',   name: 'Order Service',       description: 'Manages orders',                metadata: {}, confidence: 0.9  },
      { type: 'system',   name: 'Notification Service', description: 'Sends notifications',          metadata: {}, confidence: 0.85 },
      { type: 'data_store', name: 'Order Database',    description: 'Persists order data',           metadata: {}, confidence: 0.9  },
      { type: 'external_integration', name: 'Stripe',  description: 'Payment gateway',               metadata: {}, confidence: 0.95 },
      { type: 'endpoint', name: 'POST /checkout',      description: 'Checkout API endpoint',         metadata: {}, confidence: 0.9  },
    ],
    relationships: [
      { type: 'uses',            sourceEntityName: 'Customer',         targetEntityName: 'Checkout Service',    description: 'Places orders',         metadata: {}, confidence: 0.95 },
      { type: 'calls',           sourceEntityName: 'Checkout Service', targetEntityName: 'Payment Service',     description: 'Requests payment',      metadata: {}, confidence: 0.9  },
      { type: 'calls',           sourceEntityName: 'Checkout Service', targetEntityName: 'Order Service',       description: 'Creates order',         metadata: {}, confidence: 0.9  },
      { type: 'integrates_with', sourceEntityName: 'Payment Service',  targetEntityName: 'Stripe',              description: 'Processes via Stripe',  metadata: {}, confidence: 0.9  },
      { type: 'stores_in',       sourceEntityName: 'Order Service',    targetEntityName: 'Order Database',      description: 'Persists orders',       metadata: {}, confidence: 0.9  },
      { type: 'calls',           sourceEntityName: 'Order Service',    targetEntityName: 'Notification Service', description: 'Sends confirmation',   metadata: {}, confidence: 0.85 },
      { type: 'implements',      sourceEntityName: 'Checkout Service', targetEntityName: 'POST /checkout',      description: 'Serves endpoint',       metadata: {}, confidence: 0.9  },
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
    '    Customer[["Customer"]]',
    '    CheckoutService("Checkout Service")',
    '    PaymentService("Payment Service")',
    '    Stripe[["Stripe"]]',
    '    Customer --> |"places order"| CheckoutService',
    '    CheckoutService --> |"requests payment"| PaymentService',
    '    PaymentService --> |"processes"| Stripe',
  ].join('\n'),

  // Default / health-check
  default: JSON.stringify({
    status: 'working',
    message: 'Mock provider is operational',
  }),

  qa: 'Based on the provided source materials, the workspace contains documentation and structured data related to the analysed domain.',
};

/**
 * Create mock model instance for testing.
 * Returns a task-aware FakeListChatModel that always produces
 * the correct response for the requested task type.
 */
export function createMockModel(options: ModelOptions = {}): FakeListChatModel {
  const taskType = options.taskType ?? 'default';
  const response = MOCK_RESPONSES[taskType] ?? MOCK_RESPONSES['default']!;

  return new FakeListChatModel({
    responses: [response],
  });
}
