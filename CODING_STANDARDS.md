# ContextOS - Coding Standards & Conventions

**Version:** 1.0  
**Date:** May 12, 2026  
**Status:** Active

## Overview

This document establishes coding standards, conventions, and best practices for ContextOS development. Consistency in code style, structure, and patterns enables maintainability, readability, and collaboration.

---

## General Principles

### The Zen of ContextOS Code

1. **Clarity over Cleverness** - Code should be obvious, not clever
2. **Type Safety First** - Leverage TypeScript's type system fully
3. **Fail Fast** - Validate early, throw clear errors
4. **Domain Language** - Use ubiquitous language from domain specs
5. **SOLID Principles** - Especially Single Responsibility and Dependency Inversion
6. **DRY but not WET** - Don't repeat yourself, but don't over-abstract
7. **Explicit over Implicit** - No magic, no hidden behavior
8. **Test What Matters** - Focus tests on business logic and integrations
9. **Document Why, Not What** - Code explains what, comments explain why
10. **Performance Second** - Optimize after profiling, not before

---

## TypeScript Standards

### Strictness Configuration

**tsconfig.base.json:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

### Type Definitions

#### DO: Define explicit types
```typescript
// ✅ GOOD
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

function createUser(data: Omit<User, 'id' | 'createdAt'>): User {
  return {
    id: generateId(),
    email: data.email,
    name: data.name,
    createdAt: new Date(),
  };
}
```

#### DON'T: Use implicit any or loose types
```typescript
// ❌ BAD
function processData(data: any) {
  return data.value.toLowerCase(); // No type safety
}

// ❌ BAD
interface User {
  [key: string]: any; // Loses all type safety
}
```

### Nullability

#### DO: Handle null/undefined explicitly
```typescript
// ✅ GOOD
function findUser(id: string): User | null {
  const user = db.users.get(id);
  return user ?? null;
}

// ✅ GOOD - Use optional chaining
const userName = user?.profile?.name ?? 'Anonymous';

// ✅ GOOD - Type narrowing
if (user !== null) {
  console.log(user.name); // TypeScript knows user is not null
}
```

#### DON'T: Use non-null assertions carelessly
```typescript
// ❌ BAD - Unsafe
const user = findUser(id)!; // Could throw at runtime

// ⚠️ ACCEPTABLE ONLY if you're certain and can justify
const user = findUser(id)!; // SAFETY: ID validated by middleware
```

### Enums vs Union Types

#### DO: Use const enums or union types
```typescript
// ✅ GOOD - Union type (preferred)
type Status = 'active' | 'inactive' | 'pending';

// ✅ GOOD - Const enum (when you need reverse mapping)
const enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  ERROR = 'ERROR',
}
```

#### DON'T: Use numeric enums
```typescript
// ❌ BAD
enum Status {
  Active,
  Inactive,
  Pending,
} // Unclear values, runtime overhead
```

---

## Naming Conventions

### General Rules

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `const userName = ...` |
| Constants | UPPER_SNAKE_CASE | `const MAX_RETRIES = 3` |
| Functions | camelCase | `function processDocument() {}` |
| Classes | PascalCase | `class UserRepository {}` |
| Interfaces | PascalCase | `interface User {}` |
| Types | PascalCase | `type Status = ...` |
| Enums | PascalCase | `enum LogLevel {}` |
| Files | kebab-case | `user-repository.ts` |
| Folders | kebab-case | `document-processing/` |

### Domain-Specific Naming

```typescript
// ✅ GOOD - Use domain language
interface Document {
  id: string;
  workspaceId: string;
  sourceId: string;
  extractedAt: Date;
}

class IngestionService {
  async ingestDocument(sourceId: string): Promise<Document> {
    // ...
  }
}

// ❌ BAD - Generic, unclear names
interface Record {
  id: string;
  parent: string;
  timestamp: Date;
}

class DataService {
  async processItem(id: string): Promise<Record> {
    // ...
  }
}
```

### Boolean Names

```typescript
// ✅ GOOD - Prefix with is/has/can/should
const isActive = true;
const hasPermission = false;
const canEdit = checkPermissions(user);
const shouldRetry = error.retryable;

// ❌ BAD
const active = true; // Unclear type
const permission = false; // What about permission?
```

### Function Names

```typescript
// ✅ GOOD - Verb + Noun
async function fetchDocument(id: string): Promise<Document> {}
async function createWorkspace(data: CreateWorkspaceInput): Promise<Workspace> {}
async function validateEmail(email: string): Promise<boolean> {}

// ❌ BAD - Noun only
async function document(id: string): Promise<Document> {}
async function workspace(data: any): Promise<Workspace> {}
```

---

## Code Organization

### File Structure

```typescript
// ✅ GOOD - Organized imports
// 1. External dependencies
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// 2. Internal packages
import type { Document } from '@contextos/types';
import { logger } from '@contextos/observability';

// 3. Relative imports
import { extractContent } from './extractor';
import type { ExtractorConfig } from './types';

// Constants
const MAX_CHUNK_SIZE = 1000;

// Types
interface ChunkingOptions {
  maxSize: number;
  overlap: number;
}

// Main code
export class DocumentChunker {
  // ...
}
```

### Module Exports

```typescript
// ✅ GOOD - Named exports (preferred)
export class UserRepository {}
export function createUser() {}
export const MAX_USERS = 100;

// ✅ GOOD - Barrel exports in index.ts
export { UserRepository } from './user-repository';
export { RoleManager } from './role-manager';
export type { User, Role } from './types';

// ❌ BAD - Default exports (harder to refactor)
export default class UserRepository {}
```

---

## Error Handling

### Error Classes

```typescript
// ✅ GOOD - Domain-specific error hierarchy
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class IngestionError extends DomainError {}
export class RetrievalError extends DomainError {}

// Usage
throw new IngestionError(
  'EXTRACTION_FAILED',
  'Failed to extract content from PDF',
  { documentId, reason: 'corrupted' }
);
```

### Error Handling Patterns

```typescript
// ✅ GOOD - Specific error handling
async function processDocument(id: string): Promise<Document> {
  try {
    const raw = await fetchRawDocument(id);
    const extracted = await extractContent(raw);
    return await saveDocument(extracted);
  } catch (error) {
    if (error instanceof ExtractionError) {
      logger.warn('Extraction failed, queuing for manual review', { documentId: id });
      await queueForReview(id);
      throw error;
    }
    
    if (error instanceof NetworkError) {
      logger.error('Network error during processing', { documentId: id, error });
      // Retry logic
      return retryWithBackoff(() => processDocument(id));
    }
    
    // Unexpected error
    logger.error('Unexpected error processing document', { documentId: id, error });
    throw new IngestionError('PROCESSING_FAILED', 'Failed to process document', { documentId, error });
  }
}

// ❌ BAD - Catch-all without handling
async function processDocument(id: string): Promise<Document> {
  try {
    // ...
  } catch (error) {
    console.log(error); // Lost context
    return null; // Silent failure
  }
}
```

### Result Type Pattern (Optional)

```typescript
// For operations where failure is expected and should be handled explicitly
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

async function parseDocument(content: string): Promise<Result<ParsedDocument>> {
  try {
    const parsed = JSON.parse(content);
    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}

// Usage
const result = await parseDocument(content);
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```

---

## Async/Await

### DO: Use async/await consistently

```typescript
// ✅ GOOD
async function fetchUserData(userId: string): Promise<UserData> {
  const user = await userRepository.findById(userId);
  const permissions = await permissionService.getUserPermissions(userId);
  return { user, permissions };
}

// ✅ GOOD - Parallel execution
async function fetchWorkspaceData(workspaceId: string): Promise<WorkspaceData> {
  const [documents, members, settings] = await Promise.all([
    documentRepository.findByWorkspace(workspaceId),
    memberRepository.findByWorkspace(workspaceId),
    settingsRepository.findByWorkspace(workspaceId),
  ]);
  
  return { documents, members, settings };
}
```

### DON'T: Mix promises and async/await

```typescript
// ❌ BAD - Inconsistent
async function fetchData(id: string) {
  return dataRepository.findById(id).then(data => {
    return processData(data);
  });
}

// ❌ BAD - Not awaiting
async function saveData(data: Data) {
  dataRepository.save(data); // Promise ignored
  console.log('Saved'); // Might log before save completes
}
```

---

## Validation

### Use Zod for Runtime Validation

```typescript
import { z } from 'zod';

// ✅ GOOD - Define schema and infer type
export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

// ✅ GOOD - Validate at boundaries
export async function createWorkspace(
  input: unknown
): Promise<Workspace> {
  // Validate and parse
  const validated = CreateWorkspaceSchema.parse(input);
  
  // Now validated has the correct type
  return await workspaceRepository.create(validated);
}
```

---

## Database Patterns

### Repository Pattern

```typescript
// ✅ GOOD - Repository interface
export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  findByOwner(ownerId: string): Promise<Workspace[]>;
  create(data: CreateWorkspaceData): Promise<Workspace>;
  update(id: string, data: Partial<Workspace>): Promise<Workspace>;
  delete(id: string): Promise<void>;
}

// ✅ GOOD - Implementation
export class PostgresWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: Database) {}
  
  async findById(id: string): Promise<Workspace | null> {
    const row = await this.db
      .selectFrom('workspaces')
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .selectAll()
      .executeTakeFirst();
    
    return row ? this.mapToWorkspace(row) : null;
  }
  
  private mapToWorkspace(row: WorkspaceRow): Workspace {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      ownerId: row.owner_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
```

### Query Building

```typescript
// ✅ GOOD - Use query builder (Kysely, Drizzle)
const documents = await db
  .selectFrom('documents')
  .where('workspace_id', '=', workspaceId)
  .where('deleted_at', 'is', null)
  .selectAll()
  .execute();

// ❌ BAD - Raw SQL strings (SQL injection risk)
const documents = await db.query(
  `SELECT * FROM documents WHERE workspace_id = '${workspaceId}'`
);

// ✅ ACCEPTABLE - Parameterized raw SQL when needed
const documents = await db.query(
  'SELECT * FROM documents WHERE workspace_id = $1',
  [workspaceId]
);
```

---

## Testing Standards

### Test Structure

```typescript
// ✅ GOOD - Arrange-Act-Assert pattern
describe('DocumentChunker', () => {
  describe('chunk', () => {
    it('should split document into chunks of max size', async () => {
      // Arrange
      const chunker = new DocumentChunker({ maxSize: 100, overlap: 20 });
      const document = createTestDocument({ content: 'a'.repeat(250) });
      
      // Act
      const chunks = await chunker.chunk(document);
      
      // Assert
      expect(chunks).toHaveLength(3);
      expect(chunks[0].content).toHaveLength(100);
      expect(chunks[1].content).toHaveLength(100);
    });
    
    it('should throw error for invalid max size', () => {
      // Arrange & Act & Assert
      expect(() => new DocumentChunker({ maxSize: 0, overlap: 20 }))
        .toThrow(ValidationError);
    });
  });
});
```

### Test Naming

```typescript
// ✅ GOOD - Descriptive test names
it('should return null when document not found', async () => {});
it('should throw IngestionError when extraction fails', async () => {});
it('should cache query results for 1 hour', async () => {});

// ❌ BAD - Vague test names
it('works', () => {});
it('test document', () => {});
it('handles errors', () => {});
```

### Mocking

```typescript
// ✅ GOOD - Mock external dependencies
describe('IngestionService', () => {
  it('should call embedding service for each chunk', async () => {
    // Arrange
    const mockEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]),
    };
    
    const service = new IngestionService({
      embeddingService: mockEmbeddingService,
    });
    
    // Act
    await service.ingestDocument(testDocument);
    
    // Assert
    expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(3);
  });
});
```

---

## React/Next.js Standards

### Component Structure

```typescript
// ✅ GOOD - Typed component
interface DocumentCardProps {
  document: Document;
  onDelete: (id: string) => void;
  className?: string;
}

export function DocumentCard({ document, onDelete, className }: DocumentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(document.id);
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      <h3>{document.title}</h3>
      <button onClick={handleDelete} disabled={isDeleting}>
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );
}
```

### Server Components

```typescript
// ✅ GOOD - Server Component (Next.js 15)
// app/workspace/[id]/page.tsx
export default async function WorkspacePage({
  params,
}: {
  params: { id: string };
}) {
  const workspace = await fetchWorkspace(params.id);
  const documents = await fetchDocuments(params.id);
  
  return (
    <div>
      <h1>{workspace.name}</h1>
      <DocumentList documents={documents} />
    </div>
  );
}
```

### Client Components

```typescript
// ✅ GOOD - Client Component with "use client"
'use client';

import { useState } from 'react';

export function QueryInterface() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
    const data = await response.json();
    setResult(data);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <button type="submit">Search</button>
      {result && <ResultDisplay result={result} />}
    </form>
  );
}
```

---

## Logging

### Structured Logging

```typescript
// ✅ GOOD - Structured logs with context
logger.info('Document ingested', {
  documentId: document.id,
  workspaceId: document.workspaceId,
  size: document.size,
  duration: Date.now() - startTime,
});

logger.error('Failed to generate embeddings', {
  documentId: document.id,
  chunkCount: chunks.length,
  error: error.message,
  stack: error.stack,
});

// ❌ BAD - String interpolation
console.log(`Document ${document.id} ingested`);
console.error('Error:', error);
```

### Log Levels

```typescript
// DEBUG - Detailed information for debugging
logger.debug('Chunk created', { chunkId, tokenCount });

// INFO - General informational messages
logger.info('User logged in', { userId, timestamp });

// WARN - Warning messages, recoverable issues
logger.warn('Query cache miss', { query });

// ERROR - Error messages, needs attention
logger.error('Database connection failed', { error });
```

---

## Comments & Documentation

### When to Comment

```typescript
// ✅ GOOD - Explain WHY, not WHAT
// We use cosine similarity instead of euclidean because
// it's invariant to vector magnitude, which is important
// when comparing embeddings of different length documents
const similarity = cosineSimilarity(embedding1, embedding2);

// ✅ GOOD - Document complex business logic
/**
 * Calculates the staleness score for a document.
 * 
 * The score is based on:
 * - Document age (exponential decay after 90 days)
 * - Last access time (linear decay after 30 days)
 * - Number of references from other documents (bonus points)
 * 
 * Returns a score between 0 (very stale) and 1 (very fresh).
 */
function calculateStalenessScore(doc: Document): number {
  // ...
}

// ❌ BAD - Obvious comments
// Create a new user
const user = new User();

// Loop through documents
for (const doc of documents) {
  // ...
}
```

### JSDoc for Public APIs

```typescript
/**
 * Searches for documents using hybrid semantic and keyword search.
 * 
 * @param query - The search query string
 * @param workspaceId - The workspace to search within
 * @param options - Optional search configuration
 * @returns Promise resolving to array of search results
 * @throws {RetrievalError} If search fails
 * 
 * @example
 * ```typescript
 * const results = await searchDocuments(
 *   'authentication flow',
 *   'workspace-123',
 *   { limit: 10 }
 * );
 * ```
 */
export async function searchDocuments(
  query: string,
  workspaceId: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  // ...
}
```

---

## Performance Best Practices

### Lazy Loading

```typescript
// ✅ GOOD - Lazy load heavy dependencies
const importHeavyLibrary = () => import('./heavy-library');

async function processWithHeavyLibrary(data: Data) {
  const library = await importHeavyLibrary();
  return library.process(data);
}
```

### Caching

```typescript
// ✅ GOOD - Cache expensive operations
import { LRUCache } from 'lru-cache';

const embeddingCache = new LRUCache<string, number[]>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
});

async function getEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) return cached;
  
  const embedding = await generateEmbedding(text);
  embeddingCache.set(text, embedding);
  return embedding;
}
```

### Database N+1 Prevention

```typescript
// ✅ GOOD - Batch queries
async function getDocumentsWithChunks(
  documentIds: string[]
): Promise<DocumentWithChunks[]> {
  const documents = await documentRepo.findByIds(documentIds);
  const allChunks = await chunkRepo.findByDocumentIds(documentIds);
  
  // Group chunks by document
  const chunksByDoc = groupBy(allChunks, 'documentId');
  
  return documents.map(doc => ({
    ...doc,
    chunks: chunksByDoc[doc.id] || [],
  }));
}

// ❌ BAD - N+1 query
async function getDocumentsWithChunks(
  documentIds: string[]
): Promise<DocumentWithChunks[]> {
  const documents = await documentRepo.findByIds(documentIds);
  
  return Promise.all(
    documents.map(async doc => ({
      ...doc,
      chunks: await chunkRepo.findByDocumentId(doc.id), // N queries!
    }))
  );
}
```

---

## Git Commit Standards

### Conventional Commits

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(ingestion): add Excel file support

Implements Excel file connector and table extraction.
Supports .xlsx and .xls formats.

Closes #123

fix(retrieval): handle empty search results gracefully

Previously threw error on empty results, now returns empty array.

refactor(database): extract repository base class

Reduces duplication across repository implementations.

docs(architecture): update domain boundaries document
```

---

## Code Review Checklist

### Before Submitting PR

- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] No commented-out code
- [ ] No console.log statements
- [ ] Error handling implemented
- [ ] Types properly defined
- [ ] Documentation updated
- [ ] No TODOs (or documented in issue)

### During Review

- [ ] Logic is correct and clear
- [ ] Edge cases handled
- [ ] Performance acceptable
- [ ] Security considerations addressed
- [ ] Naming is clear and consistent
- [ ] No unnecessary complexity

---

## Enforcement

### Automated Checks

**ESLint:** Code style and patterns
**Prettier:** Code formatting  
**TypeScript:** Type safety  
**Jest:** Test coverage (min 70%)  
**Husky:** Pre-commit hooks  

### CI Pipeline

```yaml
# .github/workflows/ci.yml
- run: pnpm lint
- run: pnpm type-check
- run: pnpm test
- run: pnpm build
```

---

## Next Steps

1. Review standards with team
2. Set up linting and formatting
3. Configure pre-commit hooks
4. Create PR template with checklist
5. Schedule coding standards review session

---

**Document Owner:** Engineering Manager  
**Reviewers:** Full Engineering Team  
**Next Review:** Quarterly
