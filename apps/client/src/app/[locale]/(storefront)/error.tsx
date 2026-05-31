'use client';

import { PageError } from '../../../components/states/PageError';

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8">
      <PageError error={error} reset={reset} homeHref="/" />
    </div>
  );
}
