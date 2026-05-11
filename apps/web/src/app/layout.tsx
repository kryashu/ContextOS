import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'ContextOS — Workspace Intelligence',
  description: 'Visualize and analyze your workspace with ContextOS',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#0d1117',
        color: '#e6edf3',
        lineHeight: 1.6,
      }}>
        <header style={{
          borderBottom: '1px solid #30363d',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>🧠</span>
          <span style={{ fontWeight: 600, fontSize: 16 }}>ContextOS</span>
          <span style={{ color: '#8b949e', fontSize: 14 }}>Workspace Intelligence</span>
        </header>
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
