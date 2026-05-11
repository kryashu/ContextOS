'use client';

import { useEffect, useRef, useId } from 'react';

const card = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: 16,
  backgroundColor: 'var(--color-surface)',
} as const;

export default function MermaidDiagram({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, '_');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
      });

      if (cancelled || !containerRef.current) return;

      try {
        const { svg } = await mermaid.render(`mermaid_${uniqueId}`, content);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        if (!cancelled && containerRef.current) {
          containerRef.current.textContent = `Mermaid render error: ${err}`;
        }
      }
    }

    void render();
    return () => { cancelled = true; };
  }, [content, uniqueId]);

  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>🗺️ Data Flow Diagram (Level 0)</h2>
      <div
        ref={containerRef}
        style={{ overflow: 'auto', padding: 8, backgroundColor: 'var(--color-bg)', borderRadius: 6 }}
      >
        <p style={{ color: 'var(--color-muted)' }}>Loading diagram...</p>
      </div>
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-muted)' }}>Raw Mermaid source</summary>
        <pre style={{
          whiteSpace: 'pre-wrap',
          fontSize: 12,
          backgroundColor: 'var(--color-bg)',
          padding: 12,
          borderRadius: 4,
          marginTop: 4,
          overflow: 'auto',
        }}>
          {content}
        </pre>
      </details>
    </section>
  );
}
