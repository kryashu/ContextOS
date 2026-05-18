'use client';

import { Button } from '@contextos/ui';
import { PRESET_GOALS } from './preset-goals';

interface AgentCommandInputProps {
  goal: string;
  setGoal: (goal: string) => void;
  allowWrites: boolean;
  setAllowWrites: (v: boolean) => void;
  isDisabled: boolean;
  isPending: boolean;
  disabledMessage?: string;
  onSubmit: () => void;
}

export default function AgentCommandInput({
  goal,
  setGoal,
  allowWrites,
  setAllowWrites,
  isDisabled,
  isPending,
  disabledMessage,
  onSubmit,
}: AgentCommandInputProps) {
  return (
    <>
      {/* Disabled message */}
      {isDisabled && disabledMessage && (
        <p style={{ color: 'var(--color-muted)', fontSize: 14, margin: '0 0 12px' }}>
          {disabledMessage}
        </p>
      )}

      {/* Goal input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What do you want ContextOS to do with this workspace?"
          disabled={isDisabled || isPending}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-fg)',
            fontSize: 14,
            outline: 'none',
            opacity: isDisabled ? 0.5 : 1,
          }}
        />
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={isDisabled || isPending || !goal.trim()}
        >
          {isPending ? 'Running…' : 'Run'}
        </Button>
      </div>

      {/* Allow writes checkbox */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'var(--color-muted)',
          marginBottom: 12,
          cursor: isDisabled ? 'default' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={allowWrites}
          onChange={(e) => setAllowWrites(e.target.checked)}
          disabled={isDisabled || isPending}
        />
        Allow report/artifact generation
      </label>

      {/* Preset goals */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        {PRESET_GOALS.map((preset) => (
          <button
            key={preset.goal}
            onClick={() => setGoal(preset.goal)}
            disabled={isDisabled || isPending}
            style={{
              padding: '4px 10px',
              borderRadius: 14,
              border: '1px solid var(--color-border)',
              backgroundColor: goal === preset.goal ? 'var(--color-border)' : 'transparent',
              color: 'var(--color-fg)',
              fontSize: 12,
              cursor: isDisabled ? 'default' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              transition: 'background-color 0.15s',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </>
  );
}
