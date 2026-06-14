'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Store, Clock, CheckCircle, XCircle, ArrowRight, ArrowLeft,
  Package, TrendingUp, Palette, Globe, ChevronRight, AlertCircle,
  Check, Zap, Crown, Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../../../lib/store/auth.store';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SellerPlan {
  id:             string;
  name:           string;
  monthlyPrice:   number;
  maxProducts:    number | null;
  commissionRate: number;
  features:       string[];
  isActive:       boolean;
  sortOrder:      number;
}

interface StoreApplication {
  status:          'NONE' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
  name?:           string;
  rejectedReason?: string;
  createdAt?:      string;
}

interface ApplyPayload {
  name:         string;
  slug:         string;
  description?: string;
  planType?:    'COMMISSION' | 'SUBSCRIPTION';
  planId?:      string;
}

// ── Benefits grid ──────────────────────────────────────────────────────────────

const BENEFITS = [
  { icon: Package,   title: 'Sell handmade products',  desc: 'List your creations and reach thousands of buyers' },
  { icon: TrendingUp, title: 'Real-time analytics',   desc: 'Track sales, views, and conversion in one place'  },
  { icon: Palette,   title: 'Customize your shop',     desc: 'Brand your storefront with banners, bios, and more' },
  { icon: Globe,     title: 'Global reach',            desc: 'Sell to buyers in 50+ countries with multi-currency' },
];

// ── Pending state ─────────────────────────────────────────────────────────────

function PendingState({ name, createdAt }: { name?: string; createdAt?: string }) {
  const submittedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center">
          <Clock className="w-9 h-9 text-amber-500 animate-pulse" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your application is under review</h1>
          {name && <p className="text-gray-500 mt-1 text-sm">Shop name: <strong className="text-gray-700">{name}</strong></p>}
          {submittedDate && <p className="text-gray-400 text-xs mt-1">Submitted on {submittedDate}</p>}
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-left space-y-3">
          <p className="text-sm font-semibold text-amber-800">What happens next?</p>
          {[
            'Our team reviews your application within 1–3 business days',
            'You\'ll receive an email with our decision',
            'If approved, you\'ll get a link to access your Seller Hub',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-amber-700">{step}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          Questions? <a href="mailto:support@dailydaisy.com" className="text-primary underline">Contact support</a>
        </p>
      </div>
    </div>
  );
}

// ── Rejected state ────────────────────────────────────────────────────────────

function RejectedState({ reason, onReapply }: { reason?: string; onReapply: () => void }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-red-50 border-4 border-red-100 flex items-center justify-center">
          <XCircle className="w-9 h-9 text-red-400" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application not approved</h1>
          <p className="text-gray-500 mt-1 text-sm">Unfortunately your shop application was not approved at this time.</p>
        </div>

        {reason && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-left">
            <p className="text-xs font-semibold text-red-600 mb-1">Reason</p>
            <p className="text-sm text-red-700">{reason}</p>
          </div>
        )}

        <button
          onClick={onReapply}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all"
        >
          Apply again <ChevronRight className="w-4 h-4" />
        </button>

        <p className="text-xs text-gray-400">
          Questions? <a href="mailto:support@dailydaisy.com" className="text-primary underline">Contact support</a>
        </p>
      </div>
    </div>
  );
}

// ── Plan picker ────────────────────────────────────────────────────────────────

const PLAN_ICONS = [Zap, Crown, Sparkles];

function PlanPicker({
  plans,
  selectedId,
  onSelect,
  onNext,
}: {
  plans:      SellerPlan[];
  selectedId: string | null;  // null = commission (free)
  onSelect:   (id: string | null) => void;
  onNext:     () => void;
}) {
  function fmt(price: number) {
    if (price === 0) return 'Free';
    return `$${Number(price).toFixed(0)}/mo`;
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-gray-900">Choose your plan</h2>
        <p className="text-sm text-gray-400">You can upgrade anytime after your shop opens.</p>
      </div>

      <div className="space-y-3">
        {/* Free / Commission option */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={[
            'w-full text-left rounded-2xl border-2 p-4 transition-all',
            selectedId === null
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-gray-100 bg-white hover:border-gray-200',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={[
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                selectedId === null ? 'bg-primary/15 text-primary' : 'bg-gray-100 text-gray-400',
              ].join(' ')}>
                <Zap className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Commission — Free to start</p>
                <p className="text-xs text-gray-400 mt-0.5">No monthly fee · We take a % on each sale</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold text-gray-900">Free</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">forever</p>
            </div>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-1">
            {['List unlimited products', 'No upfront cost', 'Pay only when you sell'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs text-gray-500">
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {selectedId === null && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-semibold">
              <CheckCircle className="w-3.5 h-3.5" /> Selected
            </div>
          )}
        </button>

        {/* Dynamic subscription plans */}
        {plans.map((plan, idx) => {
          const Icon = PLAN_ICONS[idx % PLAN_ICONS.length] ?? Crown;
          const isSelected = selectedId === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className={[
                'w-full text-left rounded-2xl border-2 p-4 transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-gray-200',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={[
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    isSelected ? 'bg-primary/15 text-primary' : 'bg-gray-100 text-gray-400',
                  ].join(' ')}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{plan.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(Number(plan.commissionRate) * 100).toFixed(0)}% commission
                      {plan.maxProducts ? ` · up to ${plan.maxProducts} products` : ' · unlimited products'}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold text-gray-900">{fmt(plan.monthlyPrice)}</p>
                  {plan.monthlyPrice > 0 && <p className="text-[10px] text-gray-400 uppercase tracking-wide">per month</p>}
                </div>
              </div>

              {plan.features.length > 0 && (
                <ul className="mt-3 grid grid-cols-1 gap-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-500">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              {isSelected && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" /> Selected
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
      >
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Application form ───────────────────────────────────────────────────────────

function ApplicationForm({
  token,
  planId,
  planName,
  onSuccess,
  onBack,
}: {
  token:     string;
  planId:    string | null;
  planName:  string;
  onSuccess: () => void;
  onBack:    () => void;
}) {
  const [form, setForm]   = useState({ name: '', slug: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  function toSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function handleName(v: string) {
    setForm((f) => ({ ...f, name: v, slug: toSlug(v) }));
  }

  const mutation = useMutation({
    mutationFn: (payload: ApplyPayload) =>
      apiClient.post(API_ROUTES.SELLER.STORE_APPLY, payload, { token }),
    onSuccess,
    onError: (e: { message?: string }) => {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    },
  });

  function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.slug.trim()) return;
    const payload: ApplyPayload = {
      name:        form.name.trim(),
      slug:        form.slug.trim(),
      description: form.description.trim() || undefined,
    };
    if (planId) {
      payload.planType = 'SUBSCRIPTION';
      payload.planId   = planId;
    } else {
      payload.planType = 'COMMISSION';
    }
    mutation.mutate(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Selected plan badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20">
        <CheckCircle className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-primary">Plan: {planName}</span>
        <button
          type="button"
          onClick={onBack}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
        >
          Change
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Shop name *</label>
        <input
          value={form.name}
          onChange={(e) => handleName(e.target.value)}
          placeholder="e.g. Maple & Loom Studio"
          required
          maxLength={100}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Shop URL
          <span className="text-gray-400 font-normal ml-1">(auto-generated, editable)</span>
        </label>
        <div className="flex rounded-xl border border-gray-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 overflow-hidden transition-all">
          <span className="px-3 py-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 select-none shrink-0">
            dailydaisy.com/shop/
          </span>
          <input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: toSlug(e.target.value) }))}
            placeholder="your-shop-name"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9-]+"
            className="flex-1 px-3 py-3 outline-none text-sm bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Tell us about your shop
          <span className="text-gray-400 font-normal ml-1">(optional)</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="What do you make? What makes your shop unique?"
          rows={3}
          maxLength={500}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm resize-none transition-all"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={mutation.isPending || !form.name || !form.slug}
        className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {mutation.isPending ? (
          <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Submitting…</>
        ) : (
          <>Submit application <ArrowRight className="w-4 h-4" /></>
        )}
      </button>

      <p className="text-xs text-center text-gray-400">
        By submitting, you agree to our{' '}
        <a href="/terms" className="underline hover:text-gray-600">Seller Terms</a>.
      </p>
    </form>
  );
}

// ── Landing page (not logged in) ───────────────────────────────────────────────

function LandingPage({ locale }: { locale: string }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 py-16 lg:py-24 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Store className="w-3.5 h-3.5" /> Open your shop today
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
          Turn your craft into a <span className="text-primary">business</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Join thousands of independent makers selling on Daily Daisy. Apply in minutes — your first shop is free.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href={`/${locale}/login?redirect=/open-shop`}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 transition-all text-sm"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/${locale}/register?redirect=/open-shop`}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all text-sm"
          >
            Create free account
          </Link>
        </div>
      </div>

      {/* Benefits */}
      <div className="max-w-5xl mx-auto px-4 pb-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {BENEFITS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
            <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={[
            'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all',
            step === s
              ? 'bg-primary text-white'
              : step > s
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-400',
          ].join(' ')}>
            {step > s ? <Check className="w-3.5 h-3.5" /> : s}
          </div>
          <span className={`text-xs font-medium ${step === s ? 'text-gray-900' : 'text-gray-400'}`}>
            {s === 1 ? 'Choose plan' : 'Shop details'}
          </span>
          {s < 2 && <div className="w-8 h-px bg-gray-200 mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OpenShopPage() {
  const locale    = useLocale();
  const user      = useAuthStore((s) => s.user);
  const token     = useAuthStore((s) => s.accessToken);
  const isReady   = useAuthStore((s) => s.isAuthReady);

  const [submitted,   setSubmitted]   = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [step,        setStep]        = useState<1 | 2>(1);
  // null = commission (free), string = subscription plan ID
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: application, isLoading: appLoading, refetch } = useQuery<StoreApplication>({
    queryKey: ['my-store-application'],
    queryFn:  () => apiClient.get<StoreApplication>(API_ROUTES.SELLER.STORE_APPLICATION, { token: token ?? undefined }),
    enabled:  !!token && isReady,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<SellerPlan[]>({
    queryKey: ['public-seller-plans'],
    queryFn:  () => apiClient.get<SellerPlan[]>(API_ROUTES.STORES.PLANS_PUBLIC),
  });

  // Redirect active sellers to admin
  if (isReady && user && (user as unknown as Record<string, unknown>)['isSeller'] === true) {
    const adminUrl = process.env['NEXT_PUBLIC_ADMIN_URL'] ?? 'http://localhost:3001';
    if (typeof window !== 'undefined') window.location.href = adminUrl;
    return null;
  }

  // Not logged in
  if (!user) return <LandingPage locale={locale} />;

  if (appLoading || plansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const status = application?.status ?? 'NONE';

  // Store already approved — go straight to seller hub
  if (status === 'ACTIVE') {
    if (typeof window !== 'undefined') window.location.href = `/${locale}/seller`;
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
          <p className="text-sm text-gray-500">Your shop is active. Redirecting to Seller Hub…</p>
        </div>
      </div>
    );
  }

  if (submitted || status === 'PENDING') {
    return <PendingState name={application?.name} createdAt={application?.createdAt} />;
  }

  if (status === 'REJECTED' && !showForm) {
    return <RejectedState reason={application?.rejectedReason} onReapply={() => { setShowForm(true); setStep(1); }} />;
  }

  // Resolve selected plan display name
  const selectedPlan    = plans.find((p) => p.id === selectedPlanId);
  const selectedPlanName = selectedPlan ? selectedPlan.name : 'Commission (Free)';

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Open your shop</h1>
          <p className="text-gray-400 text-sm">
            Fill in a few details and we'll review your application within 1–3 business days.
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8">
          {step === 1 ? (
            <PlanPicker
              plans={plans}
              selectedId={selectedPlanId}
              onSelect={setSelectedPlanId}
              onNext={() => setStep(2)}
            />
          ) : (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-4 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to plan selection
              </button>
              <ApplicationForm
                token={token ?? ''}
                planId={selectedPlanId}
                planName={selectedPlanName}
                onSuccess={() => {
                  setSubmitted(true);
                  refetch();
                }}
                onBack={() => setStep(1)}
              />
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { step: '1', label: 'Apply',        active: true  },
            { step: '2', label: 'Get approved', active: false },
            { step: '3', label: 'Start selling', active: false },
          ].map(({ step: s, label }) => (
            <div key={s} className="space-y-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mx-auto">
                {s}
              </div>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
