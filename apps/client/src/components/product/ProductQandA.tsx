'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  MessageCircle,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  X,
} from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QAItem {
  id:          string;
  question:    string;
  askedByName: string;
  answer:      string | null;
  answeredAt:  string | null;
  upvotes:     number;
  createdAt:   string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Translator = ReturnType<typeof useTranslations>;

function formatRelativeTime(t: Translator, dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return t('today');
  if (days === 1) return t('yesterday');
  if (days < 30) return t('daysAgo', { days });
  const months = Math.floor(days / 30);
  if (months < 12) return t('monthsAgo', { months });
  return t('yearsAgo', { years: Math.floor(months / 12) });
}

// ── Ask question modal ────────────────────────────────────────────────────────

interface AskModalProps {
  productSlug: string;
  onClose:     () => void;
  onSubmitted: () => void;
}

interface FormValues { name: string; email: string; question: string }

function AskQuestionModal({ productSlug, onClose, onSubmitted }: AskModalProps) {
  const t = useTranslations('product.qanda');
  const tCommon = useTranslations('common');
  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<FormValues>();
  const [submitError, setSubmitError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const onSubmit = async (data: FormValues) => {
    setSubmitError('');
    try {
      await apiClient.post(API_ROUTES.PRODUCTS.QA(productSlug), {
        name:     data.name,
        email:    data.email || undefined,
        question: data.question,
      });
      reset();
      onSubmitted();
    } catch {
      setSubmitError(t('failedSubmit'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ask-question-title" className="w-full max-w-sm bg-background rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="ask-question-title" className="text-base font-bold text-secondary">{t('askAQuestion')}</h3>
          <button type="button" onClick={onClose} aria-label={tCommon('close')} className="p-1 text-muted hover:text-secondary rounded-lg transition-colors">
            <X aria-hidden="true" className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label htmlFor="qa-name" className="text-xs font-medium text-secondary block mb-1">{t('yourName')}</label>
            <input
              id="qa-name"
              type="text"
              {...register('name', { required: t('nameRequired') })}
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'qa-name-error' : undefined}
              placeholder={t('namePlaceholder')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {errors.name && <p id="qa-name-error" role="alert" className="text-xs text-error mt-0.5">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="qa-email" className="text-xs font-medium text-secondary block mb-1">
              {t('email')} <span className="text-muted font-normal">{t('emailOptional')}</span>
            </label>
            <input
              id="qa-email"
              {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: t('invalidEmail') } })}
              type="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'qa-email-error' : undefined}
              placeholder={t('emailPlaceholder')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {errors.email && <p id="qa-email-error" role="alert" className="text-xs text-error mt-0.5">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="qa-question" className="text-xs font-medium text-secondary block mb-1">{t('yourQuestion')}</label>
            <textarea
              id="qa-question"
              {...register('question', {
                required:  t('questionRequired'),
                maxLength: { value: 500, message: t('maxCharsError') },
              })}
              rows={3}
              required
              aria-invalid={Boolean(errors.question)}
              aria-describedby={errors.question ? 'qa-question-error qa-question-help' : 'qa-question-help'}
              placeholder={t('questionPlaceholder')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {errors.question && <p id="qa-question-error" role="alert" className="text-xs text-error mt-0.5">{errors.question.message}</p>}
            <p id="qa-question-help" className="text-xs text-muted text-right mt-0.5">{t('maxChars')}</p>
          </div>

          {submitError && <p role="alert" className="text-xs text-error">{submitError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted hover:text-secondary rounded-xl transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isSubmitting ? t('submitting') : t('submitQuestion')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ProductQandAProps {
  productSlug: string;
  initialQAs:  QAItem[];
}

const VISIBLE_DEFAULT = 5;

function QuestionListSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-hidden="true">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="rounded-xl bg-[#FAFAF8] p-5">
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 shrink-0 rounded-full bg-border" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-border" />
              <div className="h-3 w-32 rounded bg-border" />
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3 pl-10">
            <div className="h-7 w-7 shrink-0 rounded-full bg-border" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/2 rounded bg-border" />
              <div className="h-3 w-24 rounded bg-border" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductQandA({ productSlug, initialQAs }: ProductQandAProps) {
  const t = useTranslations('product.qanda');
  const [qas,       setQas]       = useState<QAItem[]>(initialQAs);
  const [isAskOpen, setIsAskOpen] = useState(false);
  const [showAll,   setShowAll]   = useState(false);
  const [upvoted,   setUpvoted]   = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('qa_upvoted');
      const parsed = stored ? JSON.parse(stored) : [];
      return new Set(Array.isArray(parsed) ? parsed as string[] : []);
    } catch { return new Set(); }
  });
  const [submitted, setSubmitted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(initialQAs.length === 0);

  const refreshQAs = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const latest = await apiClient.get<QAItem[]>(API_ROUTES.PRODUCTS.QA(productSlug), {
        cache: 'no-store',
      });
      setQas(Array.isArray(latest) ? latest : []);
    } catch {
      // Keep the server-rendered data when a background refresh is unavailable.
    } finally {
      setIsRefreshing(false);
    }
  }, [productSlug]);

  useEffect(() => {
    setQas(initialQAs);
    void refreshQAs();

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshQAs();
    };

    window.addEventListener('focus', refreshQAs);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshQAs);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [initialQAs, refreshQAs]);

  const handleUpvote = useCallback((qaId: string) => {
    if (upvoted.has(qaId)) return;
    const next = new Set([...upvoted, qaId]);
    setUpvoted(next);
    try { localStorage.setItem('qa_upvoted', JSON.stringify([...next])); } catch { /* storage unavailable (private mode/quota) — upvote still applies in-memory */ }
    setQas((prev) => prev.map((q) => q.id === qaId ? { ...q, upvotes: q.upvotes + 1 } : q));
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- optimistic UI update above already applied
    apiClient.post(API_ROUTES.PRODUCTS.QUESTION_UPVOTE(qaId)).catch(() => {});
  }, [upvoted]);

  const handleSubmitted = useCallback(() => {
    setIsAskOpen(false);
    setSubmitted(true);
    void refreshQAs();
    setTimeout(() => setSubmitted(false), 5000);
  }, [refreshQAs]);

  const visible = showAll ? qas : qas.slice(0, VISIBLE_DEFAULT);

  return (
    <section
      aria-busy={isRefreshing}
      className="mt-10 border-t border-border pt-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-secondary">
          {t('questionsAndAnswers')}
          {qas.length > 0 && (
            <span className="text-sm font-normal text-muted ml-2">({qas.length})</span>
          )}
          {isRefreshing && qas.length > 0 && (
            <LoaderCircle className="ml-2 inline h-4 w-4 animate-spin text-muted" />
          )}
        </h3>
        <button
          type="button"
          onClick={() => setIsAskOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-full text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {t('askAQuestion')}
        </button>
      </div>

      {submitted && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          {t('questionSubmitted')}
        </div>
      )}

      {isRefreshing && qas.length === 0 ? (
        <QuestionListSkeleton />
      ) : qas.length === 0 ? (
        <div className="text-center py-8 text-muted">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t('noQuestions')}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {visible.map((qa) => (
            <div key={qa.id} className="bg-[#FAFAF8] rounded-xl p-5">
              {/* Question */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-secondary/10 rounded-full flex items-center justify-center text-secondary font-bold text-xs shrink-0">
                  Q
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-secondary leading-snug">{qa.question}</p>
                  <p className="text-xs text-muted mt-1">
                    {t('askedBy', { name: qa.askedByName, time: formatRelativeTime(t, qa.createdAt) })}
                  </p>
                </div>
              </div>

              {/* Answer */}
              {qa.answer && (
                <div className="flex items-start gap-3 mt-4 pl-10">
                  <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    A
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-secondary text-sm leading-relaxed">{qa.answer}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-xs text-muted">
                        EziHubb
                        {qa.answeredAt && ` · ${formatRelativeTime(t, qa.answeredAt)}`}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleUpvote(qa.id)}
                        className={`flex items-center gap-1 text-xs transition-colors ${
                          upvoted.has(qa.id)
                            ? 'text-primary cursor-default'
                            : 'text-muted hover:text-primary'
                        }`}
                        title={t('markHelpful')}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        {t('helpful')}{qa.upvotes > 0 ? ` (${qa.upvotes})` : ''}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!qa.answer && (
                <p className="mt-3 pl-10 text-xs text-muted italic">{t('answerPending')}</p>
              )}
            </div>
          ))}

          {qas.length > VISIBLE_DEFAULT && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline mx-auto"
            >
              {showAll ? (
                <><ChevronUp className="w-4 h-4" /> {t('showLess')}</>
              ) : (
                <><ChevronDown className="w-4 h-4" /> {t('showAllQuestions', { count: qas.length })}</>
              )}
            </button>
          )}
        </div>
      )}

      {isAskOpen && (
        <AskQuestionModal
          productSlug={productSlug}
          onClose={() => setIsAskOpen(false)}
          onSubmitted={handleSubmitted}
        />
      )}
    </section>
  );
}
