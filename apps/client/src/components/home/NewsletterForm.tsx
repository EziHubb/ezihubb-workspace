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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email) setSubmitted(true);
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
          className="flex-1 px-4 py-3 rounded-button bg-white/10 border border-white/20 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          type="submit"
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-button transition-colors uppercase tracking-wide text-sm whitespace-nowrap"
        >
          {ctaLabel}
        </button>
      </form>
      <p className="text-gray-400 text-xs mt-4">{disclaimer}</p>
    </>
  );
}
