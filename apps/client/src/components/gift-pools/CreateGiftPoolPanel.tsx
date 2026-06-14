'use client';

import { useState } from 'react';
import {
  Gift,
  Copy,
  Check,
  X,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useToast } from '@mlh/ui';
import { apiClient } from '@mlh/api-client';
import { useAuthStore } from '../../lib/store/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id:       string;
  name:     string;
  basePrice: number;
  imageUrl?: string | null;
}

interface Props {
  product:   Product;
  onClose:   () => void;
  onCreated: (shareUrl: string) => void;
}

interface CreateGiftPoolResponse {
  id:         string;
  shareToken: string;
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < step
              ? 'w-2 h-2 bg-primary'
              : i === step
              ? 'w-3 h-3 bg-primary'
              : 'w-2 h-2 bg-border'
          }`}
        />
      ))}
    </div>
  );
}

// ── Date preset pills ─────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { label: '3 days',  days: 3 },
  { label: '7 days',  days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
] as const;

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Social share pills ────────────────────────────────────────────────────────

function SocialPills({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const waUrl = `https://wa.me/?text=${encodeURIComponent(`Join my gift pool! ${shareUrl}`)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-button border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
      >
        WhatsApp
      </a>
      <a
        href={fbUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-button border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
      >
        Facebook
      </a>
      <button
        type="button"
        onClick={copy}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-button border border-border text-secondary hover:bg-background transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CreateGiftPoolPanel({ product, onClose, onCreated }: Props) {
  const toast       = useToast();
  const token       = useAuthStore((s) => s.accessToken);

  const [step, setStep]                     = useState(0);
  const [recipientName, setRecipientName]   = useState('');
  const [message, setMessage]               = useState('');
  const [targetAmount, setTargetAmount]     = useState(product.basePrice);
  const [deadline, setDeadline]             = useState(addDays(7));
  const [loading, setLoading]               = useState(false);
  const [shareUrl, setShareUrl]             = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(7);

  const handlePreset = (days: number) => {
    setSelectedPreset(days);
    setDeadline(addDays(days));
  };

  const handleDeadlineChange = (val: string) => {
    setDeadline(val);
    setSelectedPreset(null);
  };

  const canNext1 = recipientName.trim().length > 0;
  const canNext2 = targetAmount > 0 && deadline.length > 0;

  const handleCreate = async () => {
    if (!token) {
      toast.error('Please sign in to create a gift pool');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<CreateGiftPoolResponse>('/gift-pools', {
        productId:     product.id,
        recipientName: recipientName.trim(),
        message:       message.trim(),
        targetAmount,
        deadline:      new Date(deadline).toISOString(),
      }, { token });
      const url = `${window.location.origin}/gift-pools/${res.shareToken}`;
      setShareUrl(url);
      setStep(3);
      onCreated(url);
    } catch {
      toast.error('Failed to create gift pool. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-card p-5 w-full">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-secondary text-sm">Start a Gift Pool</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1 rounded text-muted hover:text-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {step < 3 && <StepDots step={step} total={3} />}

      {/* ── Step 0: Recipient ──────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Who is this gift for?</p>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              Recipient name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              maxLength={80}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              Gift message <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a heartfelt message for the recipient…"
              className="w-full border border-border rounded-input px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
            />
            <p className="text-[11px] text-muted text-right mt-0.5">{message.length}/500</p>
          </div>

          <button
            type="button"
            disabled={!canNext1}
            onClick={() => setStep(1)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold py-2.5 rounded-button hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 1: Amount & Deadline ─────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Set a funding goal and deadline.</p>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              Target amount ($)
            </label>
            <input
              type="number"
              min={1}
              step={0.01}
              value={targetAmount}
              onChange={(e) => setTargetAmount(Number(e.target.value))}
              className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
            />
            <p className="text-[11px] text-muted mt-0.5">Product price: ${product.basePrice.toFixed(2)}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1.5">Deadline</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => handlePreset(p.days)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-button border transition-colors ${
                    selectedPreset === p.days
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-secondary hover:bg-background'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={deadline}
              min={addDays(1)}
              onChange={(e) => handleDeadlineChange(e.target.value)}
              className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="shrink-0 px-4 border border-border text-secondary text-sm font-semibold py-2.5 rounded-button hover:bg-background transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!canNext2}
              onClick={() => setStep(2)}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold py-2.5 rounded-button hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Preview
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ───────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Review your gift pool before launching.</p>

          <div className="bg-background border border-border rounded-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-12 h-12 rounded-card object-cover border border-border shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-card bg-border/20 flex items-center justify-center shrink-0">
                  <Gift className="w-6 h-6 text-muted/40" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs text-muted">Product</p>
                <p className="text-sm font-semibold text-secondary truncate">{product.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted">Recipient</p>
                <p className="font-semibold text-secondary">{recipientName}</p>
              </div>
              <div>
                <p className="text-muted">Goal</p>
                <p className="font-semibold text-secondary">${targetAmount.toFixed(2)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted">Deadline</p>
                <p className="font-semibold text-secondary">{formatDate(deadline)}</p>
              </div>
              {message && (
                <div className="col-span-2">
                  <p className="text-muted">Message</p>
                  <p className="text-secondary italic line-clamp-2">"{message}"</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold py-2.5 rounded-button hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Launching…
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  Launch gift pool &amp; get link
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-sm font-semibold text-secondary py-2 rounded-button border border-border hover:bg-background transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Success ───────────────────────────────────────────────── */}
      {step === 3 && shareUrl && (
        <div className="space-y-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-secondary">Gift pool created!</h3>
            <p className="text-xs text-muted">
              Share the link below so friends and family can contribute.
            </p>
          </div>

          <div className="flex items-center gap-2 text-left">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 border border-border rounded-input px-3 py-2 text-xs text-muted bg-background/50 focus:outline-none"
            />
          </div>

          <SocialPills shareUrl={shareUrl} />

          <button
            type="button"
            onClick={onClose}
            className="w-full text-xs text-muted hover:text-secondary transition-colors mt-1 underline"
          >
            Close panel
          </button>
        </div>
      )}
    </div>
  );
}
