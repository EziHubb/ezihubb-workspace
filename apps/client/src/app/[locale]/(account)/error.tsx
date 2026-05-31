'use client';

import { PageError } from '../../../components/states/PageError';

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError error={error} reset={reset} homeHref="/" />;
}
