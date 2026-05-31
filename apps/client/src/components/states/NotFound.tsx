import Link from 'next/link';

export interface NotFoundProps {
  title?:       string;
  description?: string;
  showSearch?:  boolean;
  backHref?:    string;
  homeHref?:    string;
}

export function NotFound({
  title       = 'Page Not Found',
  description = "The page you're looking for doesn't exist or has been moved.",
  showSearch  = false,
  backHref,
  homeHref    = '/',
}: NotFoundProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* 404 coral text */}
      <p className="font-display text-7xl font-bold text-primary/20 leading-none mb-4">
        404
      </p>

      {/* Illustration */}
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true" className="mb-6 text-muted/20">
        <circle cx="36" cy="34" r="22" stroke="currentColor" strokeWidth="5" />
        <path d="M52 50l18 18" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d="M26 24l20 20M46 24L26 44" stroke="#E85D3F" strokeWidth="4" strokeLinecap="round" />
      </svg>

      <h1 className="font-display text-2xl font-bold text-secondary mb-2">{title}</h1>
      <p className="text-sm text-muted max-w-sm mb-8">{description}</p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex items-center justify-center gap-2 border border-border text-secondary text-sm font-medium px-6 py-3 rounded-button hover:border-primary hover:text-primary transition-colors"
          >
            ← Go Back
          </Link>
        ) : null}
        <Link
          href={homeHref}
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-3 rounded-button transition-colors"
        >
          Go to Homepage
        </Link>
      </div>

      {/* Optional inline search */}
      {showSearch && (
        <form action="/search" method="GET" className="w-full max-w-sm">
          <div className="flex gap-2">
            <input
              name="q"
              type="search"
              placeholder="Search for gifts…"
              className="flex-1 px-3 py-2.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-button hover:bg-primary-dark transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
