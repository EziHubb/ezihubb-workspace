'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ArrowLeft, Search } from 'lucide-react';
import { Button, Input } from '@ezihubb/ui';
import type { OrderDto } from '@ezihubb/types';
import { OrderTrackingCard } from '../../../../../components/orders/OrderTrackingCard';
import { API_BASE } from '../../../../../lib/api-client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const at  = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * Formats typing into the current order-number shape: EZH-123456.
 *
 * The previous version inserted a second dash at seven characters, for the old
 * MLH-<year>-<00001> numbers. Left alone it would have turned a pasted
 * "EZH-123456" into "EZH-1234-56" and the lookup would never have matched.
 *
 * Old MLH numbers still type through: they are longer, so the tail simply
 * stays after the first dash rather than being re-grouped.
 */
function formatOrderNumber(raw: string): string {
  const clean = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Search form (STATE 1) ──────────────────────────────────────────────────────

interface SearchFormProps {
  onSuccess: (order: OrderDto, email: string) => void;
  locale:    string;
}

function SearchForm({ onSuccess, locale }: SearchFormProps) {
  const t = useTranslations('orderTracking');
  // Seeded from the query string so the link on the order-success page and
  // in the confirmation email lands on a form that is already filled in.
  // Read once as the initial state rather than in an effect: an effect would
  // render an empty form first and then overwrite whatever the buyer had
  // started typing.
  const params = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(() => formatOrderNumber(params.get('orderNumber') ?? ''));
  const [email,       setEmail]       = useState(() => params.get('email') ?? '');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ orderNumber?: string; email?: string }>({});

  const handleOrderNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatOrderNumber(e.target.value);
    setOrderNumber(formatted);
    if (fieldErrors.orderNumber) setFieldErrors((p) => ({ ...p, orderNumber: undefined }));
  };

  const validate = (): boolean => {
    const errs: typeof fieldErrors = {};
    if (!orderNumber.trim()) errs.orderNumber = t('orderNumberRequired');
    if (!email.trim())       errs.email = t('emailRequired');
    else if (!isValidEmail(email)) errs.email = t('invalidEmail');
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      const url = new URL(
        `/api/v1/orders/${encodeURIComponent(orderNumber.trim())}`,
        API_BASE,
      );
      url.searchParams.set('email', email.trim());

      const res = await fetch(url.toString(), {
        method:      'GET',
        credentials: 'include',
        headers:     { Accept: 'application/json' },
      });

      if (res.status === 404 || res.status === 401) {
        setError(t('notFound'));
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json   = await res.json();
      const order: OrderDto = json?.data ?? json;
      onSuccess(order, email.trim());
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-20">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-secondary">
          Track Your Order
        </h1>
        <p className="mt-3 text-muted text-sm md:text-base max-w-sm mx-auto">
          Enter your order number and email to see the latest status.
        </p>
      </div>

      {/* Card */}
      <div className="max-w-[560px] mx-auto bg-surface border border-border rounded-card shadow-sm">
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          <Input
            label="Order Number *"
            placeholder="e.g. EZH-123456"
            value={orderNumber}
            onChange={handleOrderNumberChange}
            error={fieldErrors.orderNumber}
            fullWidth
            className="font-mono"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />

          <Input
            label="Email Address *"
            type="email"
            placeholder="Email used at checkout"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            error={fieldErrors.email}
            fullWidth
            autoComplete="email"
          />

          {/* Inline error for not-found */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-sm px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            loading={loading}
            leftIcon={<Search className="h-5 w-5" />}
          >
            Track Order
          </Button>
        </form>

        <div className="px-6 pb-5 text-center">
          <p className="text-sm text-muted">
            Have an account?{' '}
            <Link
              href={`/${locale}/login`}
              className="text-primary font-medium hover:underline"
            >
              Sign in to see all orders
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Order result (STATE 2) ─────────────────────────────────────────────────────

interface OrderResultProps {
  order:      OrderDto;
  email:      string;
  onReset:    () => void;
}

function OrderResult({ order, email, onReset }: OrderResultProps) {
  const locale = useLocale();
  const [currentOrder, setCurrentOrder] = useState(order);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Back link */}
      <button
        onClick={onReset}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Track another order
      </button>

      {/* Masked email notice */}
      <p className="text-xs text-muted mb-4">
        Confirmation sent to{' '}
        <span className="font-medium text-secondary">{maskEmail(email)}</span>
      </p>

      <div className="max-w-2xl">
        <OrderTrackingCard
          order={currentOrder}
          guestEmail={email}
          onCancel={(updated) => setCurrentOrder(updated)}
        />
      </div>

      <div className="mt-6">
        <Link
          href={`/${locale}/pages/contact?subject=order`}
          className="text-sm text-muted hover:text-primary transition-colors"
        >
          Need help with this order? →
        </Link>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrackOrderPage() {
  const locale = useLocale();
  const [result, setResult] = useState<{ order: OrderDto; email: string } | null>(null);

  if (result) {
    return (
      <OrderResult
        order={result.order}
        email={result.email}
        onReset={() => setResult(null)}
      />
    );
  }

  return (
    <SearchForm
      locale={locale}
      onSuccess={(order, email) => setResult({ order, email })}
    />
  );
}
