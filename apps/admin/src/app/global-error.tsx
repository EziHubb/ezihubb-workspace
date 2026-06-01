'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env['NODE_ENV'] !== 'production') {
      console.error('[Global Error Boundary]', error);
    }
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'sans-serif', background: '#f9fafb' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: '2rem',
        }}>
          <div style={{
            background: '#fff', border: '1px solid #fecaca', borderRadius: '12px',
            padding: '2rem', maxWidth: '400px', width: '100%', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <div style={{
              width: '48px', height: '48px', background: '#fef2f2', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111', marginBottom: '0.5rem' }}>
              Application Error
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
              {error.message || 'A critical error occurred. Please refresh the page.'}
            </p>
            <button
              onClick={reset}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1rem', background: '#E85D3F', color: '#fff',
                border: 'none', borderRadius: '8px', fontSize: '0.875rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
            {error.digest && (
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1rem', fontFamily: 'monospace' }}>
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
