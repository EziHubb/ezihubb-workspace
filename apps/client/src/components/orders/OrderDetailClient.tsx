'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { AlertTriangle, Search } from 'lucide-react';
import { Button, Input } from '@ezihubb/ui';
import type { OrderDto } from '@ezihubb/types';
import { OrderTrackingCard } from './OrderTrackingCard';
import { API_BASE } from '../../lib/api-client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Email verification form ───────────────────────────────────────────────────

interface VerifyFormProps {
  orderNumber: string;
  onVerified:  (order: OrderDto, email: string) => void;
}

function VerifyForm({ orderNumber, onVerified }: VerifyFormProps) {
  const t = useTranslations('orderTracking');
  const locale = useLocale();
  const [email,      setEmail]      = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setError(null);

    if (!email.trim()) {
      setEmailError(t('emailRequired'));
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError(t('invalidEmail'));
      return;
    }

    setLoading(true);
    try {
      const url = new URL(
        `/api/v1/orders/${encodeURIComponent(orderNumber)}`,
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json   = await res.json();
      const order: OrderDto = json?.data ?? json;
      onVerified(order, email.trim());
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-20">
      <div className="text-center mb-10">
        <h1 className="font-display text-3xl font-bold text-secondary">
          {t('verifyTitle')}
        </h1>
        <p className="mt-2 text-muted text-sm max-w-xs mx-auto">
          {t.rich('verifySubtitle', {
            orderNumber,
            b: (chunks) => <span className="font-mono font-semibold text-secondary">{chunks}</span>,
          })}
        </p>
      </div>

      <div className="max-w-[480px] mx-auto bg-surface border border-border rounded-card shadow-sm p-6 space-y-4">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label={t('emailLabel')}
            type="email"
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            error={emailError ?? undefined}
            fullWidth
            autoComplete="email"
            autoFocus
          />

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
            leftIcon={<Search />}
          >
            {t('viewOrderButton')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted pt-1">
          <Link
            href={`/${locale}/orders/track`}
            className="text-primary font-medium hover:underline"
          >
            ← {t('trackDifferent')}
          </Link>
        </p>
      </div>
    </div>
  );
}

// ── Authenticated view (order loaded) ────────────────────────────────────────

interface OrderViewProps {
  order: OrderDto;
  email: string;
}

function OrderView({ order, email }: OrderViewProps) {
  const t = useTranslations('orderTracking');
  const locale = useLocale();
  const [currentOrder, setCurrentOrder] = useState(order);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
      <p className="text-xs text-muted mb-4">
        {t.rich('confirmationSentTo', {
          email: maskEmail(email),
          b: (chunks) => <span className="font-medium text-secondary">{chunks}</span>,
        })}
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
          {t('needHelp')} →
        </Link>
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface OrderDetailClientProps {
  orderNumber: string;
  locale:      string;
  autoVerify?: boolean;
}

export function OrderDetailClient({
  orderNumber,
  autoVerify = false,
}: OrderDetailClientProps) {
  const [verified, setVerified] = useState<{ order: OrderDto; email: string } | null>(null);

  if (verified) {
    return <OrderView order={verified.order} email={verified.email} />;
  }

  return (
    <VerifyForm
      orderNumber={orderNumber}
      onVerified={(order, email) => setVerified({ order, email })}
    />
  );
}
