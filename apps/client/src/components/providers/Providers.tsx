'use client';

/**
 * Root client-side providers wrapper.
 * Composes: React Query + toast context + auth initializer.
 *
 * Spec alias for ReactQueryProvider — use either name.
 * Pages that import from the spec's "@/components/providers/Providers" path
 * get the same fully-configured provider tree.
 */

export { ReactQueryProvider as Providers } from './ReactQueryProvider';
