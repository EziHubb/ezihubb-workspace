import { useMutation } from '@tanstack/react-query';
import { api } from '../client';

export interface SubscribeInput {
  email: string;
}

/**
 * Newsletter subscription mutation.
 * No cache invalidation needed — this is a fire-and-forget write.
 */
export function useNewsletterSubscribe() {
  return useMutation({
    mutationFn: (input: SubscribeInput) =>
      api.post<void>('/notifications/newsletter', input),
  });
}
