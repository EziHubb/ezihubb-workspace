'use client';

import { useState } from 'react';
import { useNewsletterSubscribe } from '@ezihubb/api-client';

interface NewsletterSectionProps {
  title:       string;
  subtitle:    string;
  placeholder: string;
  cta:         string;
  disclaimer:  string;
  success:     string;
}

export function NewsletterSection({
  title,
  subtitle,
  placeholder,
  cta,
  disclaimer,
  success,
}: NewsletterSectionProps) {
  const [email, setEmail] = useState('');
  const subscribe = useNewsletterSubscribe();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || subscribe.isPending) return;
    subscribe.mutate({ email: trimmed });
  };

  return (
    <section className="bg-secondary py-16 md:py-20">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
          {title}
        </h2>
        <p className="text-gray-300 text-base md:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
          {subtitle}
        </p>

        {subscribe.isSuccess ? (
          <p className="text-white font-semibold text-lg" role="status">
            🎉 {success}
          </p>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <label htmlFor="newsletter-email" className="sr-only">
                {placeholder}
              </label>
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                required
                disabled={subscribe.isPending}
                className="flex-1 min-w-0 px-4 py-3 rounded-button bg-white/10 border border-white/20 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={subscribe.isPending}
                className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-button transition-colors uppercase tracking-wide text-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {subscribe.isPending ? '…' : cta}
              </button>
            </form>

            {subscribe.isError && (
              <p className="text-red-300 text-sm mt-3" role="alert">
                {subscribe.error instanceof Error
                  ? subscribe.error.message
                  : 'Something went wrong. Please try again.'}
              </p>
            )}

            <p className="text-gray-300 text-xs mt-4">{disclaimer}</p>
          </>
        )}
      </div>
    </section>
  );
}
