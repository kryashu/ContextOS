import { checkOllamaAvailability, createChatModel, type Provider } from '@contextos/ai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import { resolve } from 'node:path';
import { rootDir } from '../bootstrap.js';

const TestSchema = z.object({
  status: z.enum(['working', 'error']),
  message: z.string(),
});

interface ProviderCheckResult {
  provider: string;
  available: boolean;
  model?: string;
  latencyMs?: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
}

export async function aiCheck(): Promise<void> {
  console.log('🔍 ContextOS AI Provider Health Check\n');

  const results: ProviderCheckResult[] = [];

  // Check mock provider (always available)
  console.log('Checking mock provider...');
  results.push(await checkProvider('mock'));

  // Check Ollama if enabled
  if (process.env['LOCAL_LLM_PROVIDER'] === 'ollama') {
    console.log('Checking Ollama...');
    results.push(await checkProvider('ollama'));
  } else {
    results.push({ 
      provider: 'ollama', 
      available: false, 
      status: 'skipped',
      error: 'LOCAL_LLM_PROVIDER not set to ollama'
    });
  }

  // Check Groq if API key exists
  if (process.env['GROQ_API_KEY']) {
    console.log('Checking Groq...');
    results.push(await checkProvider('groq'));
  } else {
    results.push({ 
      provider: 'groq', 
      available: false, 
      status: 'skipped',
      error: 'GROQ_API_KEY not configured'
    });
  }

  // Check Gemini if API key exists
  if (process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY']) {
    console.log('Checking Gemini...');
    results.push(await checkProvider('gemini'));
  } else {
    results.push({ 
      provider: 'gemini', 
      available: false, 
      status: 'skipped',
      error: 'GOOGLE_API_KEY/GEMINI_API_KEY not configured'
    });
  }

  // Print results
  console.log('\n');
  printResults(results);

  // Generate report
  const report = {
    checkedAt: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      error: results.filter(r => r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    },
  };

  // Save report
  const reportPath = resolve(rootDir, 'ai-provider-report.json');
  await fs.writeFile(
    reportPath,
    JSON.stringify(report, null, 2)
  );
  console.log(`\n📊 Report saved to ${reportPath}`);

  // Exit with error if no providers succeeded
  if (report.summary.success === 0) {
    console.error('\n❌ No providers are working. At least mock provider should succeed.');
    process.exit(1);
  }
}

async function checkProvider(provider: Provider): Promise<ProviderCheckResult> {
  const start = Date.now();

  try {
    // Check availability for Ollama
    if (provider === 'ollama') {
      const available = await checkOllamaAvailability();
      if (!available) {
        return {
          provider,
          available: false,
          status: 'error',
          error: 'Ollama not running or no models available',
        };
      }
    }

    // Create model
    const model = createChatModel(provider, { temperature: 0 });
    const modelName = getModelName(provider);

    // Run structured output test
    const prompt = 'Respond with JSON only, no markdown: {"status": "working", "message": "test successful"}';
    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    // Try to parse as JSON (strip markdown code blocks if present)
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanContent);
    TestSchema.parse(parsed);

    const latency = Date.now() - start;

    return {
      provider,
      available: true,
      model: modelName,
      latencyMs: latency,
      status: 'success',
    };
  } catch (error) {
    const latency = Date.now() - start;
    return {
      provider,
      available: false,
      latencyMs: latency,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getModelName(provider: Provider): string {
  switch (provider) {
    case 'ollama':
      return process.env['OLLAMA_MODEL'] || 'llama3.2:3b';
    case 'groq':
      return process.env['GROQ_MODEL'] || 'llama-3.3-70b-versatile';
    case 'gemini':
      return process.env['GEMINI_MODEL'] || 'gemini-1.5-flash';
    case 'openai':
      return process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
    case 'mock':
      return 'fake-list-chat-model';
    default:
      return 'unknown';
  }
}

function printResults(results: ProviderCheckResult[]): void {
  console.log('Provider Status:');
  console.log('─'.repeat(80));

  for (const result of results) {
    const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⊝';
    const name = result.provider.padEnd(10);
    
    if (result.status === 'success') {
      console.log(`${icon} ${name} ${result.model} (${result.latencyMs}ms)`);
    } else if (result.status === 'error') {
      const latency = result.latencyMs ? ` (${result.latencyMs}ms)` : '';
      console.log(`${icon} ${name} ${result.error}${latency}`);
    } else {
      console.log(`${icon} ${name} ${result.error}`);
    }
  }

  console.log('─'.repeat(80));
}
