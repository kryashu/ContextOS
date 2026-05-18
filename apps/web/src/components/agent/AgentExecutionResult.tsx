'use client';

import type { AgentRunResult } from '@contextos/agents';
import type { TableQueryResult } from '@contextos/table-query';
import type { KeyIntelligenceResult } from '@contextos/key-intelligence';
import AgentResultDisplay from './AgentResultDisplay';
import TableQueryResultDisplay from './TableQueryResultDisplay';
import KeyIntelligenceResultDisplay from './KeyIntelligenceResultDisplay';

interface AgentExecutionResultProps {
  result: AgentRunResult | null;
  tableResult: TableQueryResult | null;
  keyIntelligenceResult: KeyIntelligenceResult | null;
  error: string | null;
  generatedAt: string;
}

export default function AgentExecutionResult({
  result,
  tableResult,
  keyIntelligenceResult,
  error,
  generatedAt,
}: AgentExecutionResultProps) {
  const hasAnyResult = result || tableResult || keyIntelligenceResult || error;
  if (!hasAnyResult) return null;

  return (
    <>
      {/* Error / clarification */}
      {error && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 14,
            backgroundColor: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.3)',
            color: '#f85149',
          }}
        >
          {error}
        </div>
      )}

      {/* Agent result */}
      {result && <AgentResultDisplay result={result} generatedAt={generatedAt} />}

      {/* Table query result */}
      {tableResult && <TableQueryResultDisplay result={tableResult} />}

      {/* Key intelligence result */}
      {keyIntelligenceResult && <KeyIntelligenceResultDisplay result={keyIntelligenceResult} />}
    </>
  );
}
