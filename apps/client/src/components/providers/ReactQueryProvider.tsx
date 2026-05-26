'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,        // 1 minute — reduce background refetches
            gcTime: 5 * 60 * 1000,       // 5 minutes — keep unused data in memory
            retry: 1,
            refetchOnWindowFocus: false,  // prevent jarring refetches on tab switch
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
