'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

// A digital-only cart needs no shipping address — guests still need to give
// an email so the order can be looked up later and the download-ready email
// has somewhere to go. Logged-in users skip this step entirely (see
// checkout/page.tsx, which auto-submits without rendering this form).

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface DigitalContactFormProps {
  initialEmail?: string;
  isSubmitting: boolean;
  error?: string;
  onSubmit: (email: string) => void;
}

export function DigitalContactForm({ initialEmail, isSubmitting, error, onSubmit }: DigitalContactFormProps) {
  const [email, setEmail] = useState(initialEmail ?? '');
  const [touched, setTouched] = useState(false);

  const emailError = touched && !isValidEmail(email) ? 'Enter a valid email address' : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValidEmail(email)) return;
    onSubmit(email);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-card px-4 py-3.5">
        <Download className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-secondary">
          This order is digital only — no shipping needed. We&apos;ll email your download link and receipt here.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-secondary" htmlFor="digital-checkout-email">
          Email address<span className="text-error ml-0.5">*</span>
        </label>
        <input
          id="digital-checkout-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="you@example.com"
          className={[
            'w-full px-3 py-2.5 text-sm border rounded-button bg-background text-secondary',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
            emailError ? 'border-error' : 'border-border',
          ].join(' ')}
        />
        {emailError && <p className="text-xs text-error" role="alert">{emailError}</p>}
      </div>

      {error && (
        <p className="text-sm text-error p-3 bg-error/5 border border-error/20 rounded-sm" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 rounded-button bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {isSubmitting ? 'Preparing your order…' : 'Continue to payment'}
      </button>
    </form>
  );
}
