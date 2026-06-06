import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '4rem 1rem' }}>
        <h1 style={{ fontSize: '6rem', fontWeight: 'bold', color: '#E85D3F', margin: 0, lineHeight: 1 }}>
          404
        </h1>
        <h2 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Page Not Found</h2>
        <p style={{ color: '#888', marginBottom: '2rem' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.625rem 1.5rem',
            background: '#E85D3F',
            color: '#fff',
            borderRadius: '999px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          Go to Homepage
        </Link>
      </body>
    </html>
  );
}
