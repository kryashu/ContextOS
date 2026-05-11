/**
 * Check if Ollama is running and available
 * @returns Promise<boolean> - true if Ollama is available
 */
export async function checkOllamaAvailability(): Promise<boolean> {
  try {
    const baseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json() as { models?: unknown[] };
    return Array.isArray(data.models) && data.models.length > 0;
  } catch (error) {
    // Ollama not running or not accessible
    return false;
  }
}

/**
 * Calculate document size in KB
 * @param content - Document content
 * @returns Size in KB
 */
export function calculateDocumentSizeKB(content: string): number {
  const bytes = new TextEncoder().encode(content).length;
  return bytes / 1024;
}

/**
 * Truncate content to fit within token limit (rough approximation)
 * @param content - Content to truncate
 * @param maxTokens - Maximum number of tokens
 * @returns Truncated content
 */
export function truncateContent(content: string, maxTokens: number): string {
  // Rough approximation: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  
  if (content.length <= maxChars) {
    return content;
  }
  
  console.warn(
    `[Utils] Truncating content from ${content.length} to ${maxChars} characters (${maxTokens} tokens)`
  );
  
  return content.slice(0, maxChars) + '\n\n[... content truncated for context size limits ...]';
}
