import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: 'ContextOS — Workspace Intelligence',
  description: 'Visualize and analyze your workspace with ContextOS',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head />
      <body style={{
        margin: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-fg)',
        lineHeight: 1.6,
      }}>
        <header style={{
          borderBottom: '1px solid var(--color-border)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <Link href="/workspaces" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontSize: 20 }}>🧠</span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>ContextOS</span>
          </Link>
          <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>Workspace Intelligence</span>
          <span style={{ marginLeft: 'auto' }}><ThemeToggle /></span>
        </header>
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
