'use client';

import { useRouter } from 'next/navigation';

export function BackToResults() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-xs text-muted hover:underline flex items-center gap-1"
    >
      ← Back to search results
    </button>
  );
}
