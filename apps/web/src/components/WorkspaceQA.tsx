'use client';

import { useState, useTransition } from 'react';
import { askWorkspaceQuestion } from '@/app/workspaces/actions';
import { Badge, Banner, Button } from '@contextos/ui';
import type { WorkspaceAnswer } from '@contextos/types';

interface Props {
  workspaceId: string;
  analysisState: 'none' | 'stale' | 'current' | 'failed';
}

export default function WorkspaceQA({ workspaceId, analysisState }: Props) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<WorkspaceAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const disabled = analysisState !== 'current';

  function handleAsk() {
    if (!question.trim()) return;
    setError(null);
    setAnswer(null);

    startTransition(async () => {
      const res = await askWorkspaceQuestion(workspaceId, question);
      if (res.success && res.answer) {
        setAnswer(res.answer);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div>
      {analysisState === 'stale' && (
        <Banner variant="warning">
          ⚠️ Analysis is stale — re-run analysis before asking questions.
        </Banner>
      )}

      {analysisState === 'none' && (
        <Banner variant="info">
          ℹ️ Run analysis first to enable Q&amp;A.
        </Banner>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label
            htmlFor="qa-input"
            style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--color-muted)' }}
          >
            Ask a question about this workspace
          </label>
          <input
            id="qa-input"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !disabled && !isPending) handleAsk();
            }}
            placeholder="e.g. What is this workspace about?"
            disabled={disabled || isPending}
            maxLength={500}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 14,
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              background: 'var(--color-input-bg)',
              color: 'var(--color-fg)',
            }}
          />
        </div>
        <Button onClick={handleAsk} disabled={disabled || isPending || !question.trim()}>
          {isPending ? 'Asking…' : 'Ask'}
        </Button>
      </div>

      {error && <Banner variant="error">{error}</Banner>}

      {answer && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--color-border-subtle)',
            background: 'var(--color-surface)',
          }}
        >
          <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--color-muted)' }}>
            Intent: <Badge color="#6b7280">{answer.intent}</Badge>
            {answer.confidence > 0 && (
              <span style={{ marginLeft: 8 }}>
                Confidence:{' '}
                <Badge color={answer.confidence >= 0.7 ? '#238636' : answer.confidence >= 0.4 ? '#9e6a03' : '#da3633'}>
                  {Math.round(answer.confidence * 100)}%
                </Badge>
              </span>
            )}
          </div>

          <p style={{ margin: '0 0 12px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {answer.answer}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--color-muted)', fontStyle: 'italic' }}>
            Answers are grounded in workspace analysis artifacts and may not reflect external knowledge.
          </p>

          {answer.sourceRefs.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              Sources:{' '}
              {answer.sourceRefs.map((ref, i) => (
                <span key={i} style={{ marginRight: 4, marginBottom: 4, display: 'inline-block' }}>
                  <Badge color="#4b5563">
                    {ref.fileName}
                    {ref.artifactType && ref.artifactType !== 'source-file' ? ` (${ref.artifactType})` : ''}
                  </Badge>
                  {ref.snippet && (
                    <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 2 }}>
                      &quot;{ref.snippet.slice(0, 60)}{ref.snippet.length > 60 ? '…' : ''}&quot;
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {answer.warnings.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {answer.warnings.map((w, i) => (
                <Banner key={i} variant="warning">{w}</Banner>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
