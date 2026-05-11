'use client';

import { useEffect, useRef, useId } from 'react';

const card = {
  border: '1px solid #30363d',
  borderRadius: 8,
  padding: 16,
  backgroundColor: '#161b22',
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
        style={{ overflow: 'auto', padding: 8, backgroundColor: '#0d1117', borderRadius: 6 }}
      >
        <p style={{ color: '#8b949e' }}>Loading diagram...</p>
      </div>
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: '#8b949e' }}>Raw Mermaid source</summary>
        <pre style={{
          whiteSpace: 'pre-wrap',
          fontSize: 12,
          backgroundColor: '#0d1117',
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
