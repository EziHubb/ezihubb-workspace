'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WizardQuestion {
  key:        string;
  options:    { value: string; emoji?: string }[];
}

interface GiftProduct {
  id:          string;
  name:        string;
  slug:        string;
  price:       number;
  imageUrl:    string | null;
  rating?:     number;
  reviewCount?: number;
}

// ── Wizard question config (static values/emojis; labels are translated) ──────

const QUESTIONS: WizardQuestion[] = [
  {
    key:     'relationship',
    options: [
      { value: 'partner',   emoji: '💑' },
      { value: 'friend',    emoji: '👯' },
      { value: 'parent',    emoji: '👨‍👩‍👧' },
      { value: 'sibling',   emoji: '🤝' },
      { value: 'colleague', emoji: '💼' },
      { value: 'child',     emoji: '🧒' },
    ],
  },
  {
    key:     'age_group',
    options: [
      { value: 'child',  emoji: '🧒' },
      { value: 'teen',   emoji: '🧑' },
      { value: 'young',  emoji: '👩' },
      { value: 'adult',  emoji: '🧑‍💼' },
      { value: 'senior', emoji: '👴' },
    ],
  },
  {
    key:     'interests',
    options: [
      { value: 'art',     emoji: '🎨' },
      { value: 'home',    emoji: '🏠' },
      { value: 'nature',  emoji: '🌿' },
      { value: 'fashion', emoji: '👗' },
      { value: 'food',    emoji: '🍰' },
      { value: 'travel',  emoji: '✈️' },
    ],
  },
  {
    key:     'occasion',
    options: [
      { value: 'birthday',     emoji: '🎂' },
      { value: 'anniversary',  emoji: '💍' },
      { value: 'holiday',      emoji: '🎄' },
      { value: 'graduation',   emoji: '🎓' },
      { value: 'just_because', emoji: '💝' },
      { value: 'wedding',      emoji: '💒' },
    ],
  },
  {
    key:     'budget',
    options: [
      { value: 'under_25',  emoji: '💵' },
      { value: '25_50',     emoji: '💵' },
      { value: '50_100',    emoji: '💴' },
      { value: '100_200',   emoji: '💶' },
      { value: 'over_200',  emoji: '💎' },
    ],
  },
];

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  step, total, stepLabel, pctLabel,
}: {
  step: number; total: number; stepLabel: string; pctLabel: string;
}) {
  const pct = (step / total) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted">
        <span>{stepLabel}</span>
        <span>{pctLabel}</span>
      </div>
      <div className="h-2 bg-border/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Product result card ───────────────────────────────────────────────────────

function ResultCard({ product, locale }: { product: GiftProduct; locale: string }) {
  return (
    <Link
      href={`/${locale}/products/${product.slug}`}
      className="block bg-surface border border-border rounded-card overflow-hidden hover:border-primary hover:shadow-card-hover transition-all group"
    >
      <div className="relative aspect-square bg-background overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-muted/10 flex items-center justify-center">
            <span className="text-3xl">🎁</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-semibold text-secondary line-clamp-2 leading-snug">
          {product.name}
        </h3>
        <p className="text-sm font-bold text-primary tabular-nums">
          ${product.price.toFixed(2)}
        </p>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type WizardState = 'asking' | 'loading' | 'results';

export default function GiftFinderPage() {
  const locale = useLocale();
  const t      = useTranslations('giftFinder');

  const [state,        setState]        = useState<WizardState>('asking');
  const [stepIndex,    setStepIndex]    = useState(0);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [results,      setResults]      = useState<GiftProduct[]>([]);
  const [error,        setError]        = useState<string | null>(null);

  const currentQ = QUESTIONS[stepIndex];

  const startSession = async (): Promise<string> => {
    const res = await apiClient.post<{ sessionToken: string }>('/gift-finder/session');
    setSessionToken(res.sessionToken);
    return res.sessionToken;
  };

  const handleAnswer = async (answer: string) => {
    setError(null);
    try {
      let token = sessionToken;
      if (!token) {
        token = await startSession();
      }

      const res = await apiClient.post<{ done: boolean }>(
        `/gift-finder/session/${token}/step`,
        { answer },
      );

      if (res.done || stepIndex === QUESTIONS.length - 1) {
        setState('loading');
        const products = await apiClient.get<GiftProduct[]>(
          `/gift-finder/session/${token}/results`,
        );
        setResults(products);
        setState('results');
      } else {
        setStepIndex((prev) => prev + 1);
      }
    } catch {
      setError(t('error'));
    }
  };

  const handleReset = () => {
    setState('asking');
    setStepIndex(0);
    setSessionToken(null);
    setResults([]);
    setError(null);
  };

  // ── Results view ───────────────────────────────────────────────────────────

  if (state === 'results') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-secondary">
              {t('resultsTitle')}
            </h1>
            <p className="text-sm text-muted mt-1">{t('resultsSub')}</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors border border-border rounded-button px-3 py-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('startOver')}
          </button>
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <span className="text-5xl">🎁</span>
            <div>
              <p className="font-semibold text-secondary">{t('noResults')}</p>
              <p className="text-sm text-muted mt-1">{t('noResultsSub')}</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-3 rounded-button transition-colors uppercase tracking-wide"
            >
              {t('tryAgain')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map((p) => (
              <ResultCard key={p.id} product={p} locale={locale} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 flex flex-col items-center gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
        <div>
          <p className="font-display text-xl font-bold text-secondary">{t('loading')}</p>
          <p className="text-sm text-muted mt-1">{t('loadingSub')}</p>
        </div>
      </div>
    );
  }

  // ── Wizard step ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">{t('title')}</h1>
        <p className="text-sm text-muted mt-1">{t('subtitle')}</p>
      </div>

      <ProgressBar
        step={stepIndex + 1}
        total={QUESTIONS.length}
        stepLabel={t('stepOf', { step: stepIndex + 1, total: QUESTIONS.length })}
        pctLabel={t('percentComplete', { pct: Math.round(((stepIndex + 1) / QUESTIONS.length) * 100) })}
      />

      <div className="bg-surface border border-border rounded-card p-6 space-y-5">
        <h2 className="font-semibold text-lg text-secondary">
          {t(`questions.${currentQ.key}`)}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {currentQ.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleAnswer(opt.value)}
              className="flex flex-col items-center gap-2 border border-border rounded-card p-4 hover:border-primary hover:bg-primary/5 transition-all group text-center"
            >
              {opt.emoji && <span className="text-2xl">{opt.emoji}</span>}
              <span className="text-sm font-medium text-secondary group-hover:text-primary transition-colors">
                {t(`options.${currentQ.key}.${opt.value}`)}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-error text-center">{error}</p>}
      </div>

      {stepIndex > 0 && (
        <button
          type="button"
          onClick={() => setStepIndex((prev) => prev - 1)}
          className="text-sm text-muted hover:text-secondary transition-colors flex items-center gap-1.5 mx-auto"
        >
          {t('back')}
        </button>
      )}
    </div>
  );
}
