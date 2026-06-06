'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '4rem 1rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Something went wrong</h2>
        {error.digest && (
          <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: '1.5rem' }}>
            {'Error ID: ' + error.digest}
          </p>
        )}
        <button type="button" onClick={reset} style={{ padding: '0.5rem 1.5rem', cursor: 'pointer', marginRight: '0.5rem' }}>
          Try again
        </button>
        <Link href="/" style={{ color: '#E85D3F', fontSize: '0.875rem' }}>
          Return to Home
        </Link>
      </body>
    </html>
  );
}
