'use client';

import { useState } from 'react';

interface NewsletterFormProps {
  placeholder: string;
  ctaLabel: string;
  disclaimer: string;
  successMessage: string;
}

export function NewsletterForm({ placeholder, ctaLabel, disclaimer, successMessage }: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';
      const res = await fetch(`${apiBase}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? 'Subscription failed');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <p className="text-white font-medium text-lg">
        ✓ {successMessage}
      </p>
    );
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          required
          disabled={isLoading}
          className="flex-1 px-4 py-3 rounded-button bg-white/10 border border-white/20 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-button transition-colors uppercase tracking-wide text-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? '...' : ctaLabel}
        </button>
      </form>
      {error && <p className="text-red-300 text-xs mt-2">{error}</p>}
      <p className="text-gray-400 text-xs mt-4">{disclaimer}</p>
    </>
  );
}
