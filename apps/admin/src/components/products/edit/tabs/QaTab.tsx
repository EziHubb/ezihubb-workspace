'use client';

import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { useDialog } from '../../../../contexts/DialogContext';
import { MessageCircle, Check, Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtDate, safeArr } from '../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Question {
  id:           string;
  productId:    string;
  question:     string;
  askedByName:  string;
  askedByEmail: string | null;
  answer:       string | null;
  answeredAt:   string | null;
  isPublished:  boolean;
  isSpam:       boolean;
  upvotes:      number;
  createdAt:    string;
  product?: {
    id:       string;
    name:     string;
    slug:     string;
    imageUrl: string | null;
    store?:   { id: string; name: string } | null;
  };
}

// ── Question row ──────────────────────────────────────────────────────────────

interface QuestionRowProps {
  q:          Question;
  productId:  string;
  onRefresh?: () => void | Promise<unknown>;
}

export function QuestionRow({ q, productId, onRefresh }: QuestionRowProps) {
  const { confirm } = useDialog();
  const qc = useQueryClient();
  const [answer,    setAnswer]    = useState(q.answer ?? '');
  const [publish,   setPublish]   = useState(q.isPublished);
  const [expanded,  setExpanded]  = useState(!q.answer);
  const [saving,    setSaving]    = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    setAnswer(q.answer ?? '');
    setPublish(q.isPublished);
  }, [q.answer, q.isPublished]);

  const notifyChanged = async () => {
    await Promise.all([
      Promise.resolve(onRefresh?.()),
      qc.invalidateQueries({ queryKey: ['admin-questions'] }),
      qc.invalidateQueries({ queryKey: ['sidebar-questions-unanswered'] }),
    ]);
  };

  const handleSave = async () => {
    if (!answer.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post(API_ROUTES.ADMIN.PRODUCT_QUESTION_ANSWER(productId, q.id), { answer: answer.trim(), publish });
      await notifyChanged();
      setExpanded(false);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    setPublishing(true);
    setError('');
    try {
      await api.patch(API_ROUTES.ADMIN.PRODUCT_QUESTION(productId, q.id), { isPublished: !q.isPublished });
      await notifyChanged();
    } catch {
      setError('Failed to update publish status. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!await confirm('Delete this question? This cannot be undone.', { confirmLabel: 'Delete', destructive: true })) return;
    setDeleting(true);
    try {
      await api.delete(API_ROUTES.ADMIN.PRODUCT_QUESTION(productId, q.id));
      await notifyChanged();
    } catch {
      setError('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSpam = async () => {
    if (!await confirm('Mark as spam? This will hide the question.', { confirmLabel: 'Mark as spam', destructive: true })) return;
    setError('');
    try {
      await api.post(API_ROUTES.ADMIN.PRODUCT_QUESTION_SPAM(productId, q.id));
      await notifyChanged();
    } catch {
      setError('Failed to mark as spam. Please try again.');
    }
  };

  const needsAnswer = !q.answer;

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${needsAnswer ? 'border-amber-300 bg-amber-50' : 'border-border bg-surface'}`}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        {q.product?.imageUrl && (
          <Image
            src={q.product.imageUrl}
            alt={q.product.name}
            width={48}
            height={48}
            className="w-12 h-12 rounded-lg object-cover border border-border shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          {q.product && (
            <div className="flex items-center gap-2 mb-1 text-xs">
              <Link
                href={`/products/${q.product.id}/edit#customer-qa`}
                className="font-semibold text-primary hover:underline truncate"
              >
                {q.product.name}
              </Link>
              {q.product.store?.name && (
                <span className="text-muted shrink-0">· {q.product.store.name}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {needsAnswer && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-semibold">
                <AlertTriangle className="w-3 h-3" />
                Unanswered
              </span>
            )}
            {q.isPublished && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[11px] font-semibold">Answer published</span>
            )}
            {q.answer && !q.isPublished && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[11px] font-semibold">Draft answer</span>
            )}
          </div>
          <p className="font-medium text-secondary text-sm mt-1 leading-snug">{q.question}</p>
          <p className="text-xs text-muted mt-0.5">
            {q.askedByName}
            {q.askedByEmail && ` · ${q.askedByEmail}`}
            {' · '}{fmtDate(q.createdAt)}
            {q.upvotes > 0 && ` · ${q.upvotes} helpful`}
          </p>
          {q.answer && !expanded && (
            <p className="text-sm text-secondary mt-2 line-clamp-2 italic">&ldquo;{q.answer}&rdquo;</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {q.answer && (
            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={publishing}
              title={q.isPublished ? 'Unpublish answer' : 'Publish answer'}
              className="p-1.5 rounded-lg text-muted hover:text-secondary hover:bg-muted/10 transition-colors disabled:opacity-40"
            >
              <Check className={`w-4 h-4 ${q.isPublished ? 'text-green-600' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((s) => !s)}
            className="p-1.5 rounded-lg text-muted hover:text-secondary hover:bg-muted/10 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleSpam}
            className="p-1.5 rounded-lg text-muted hover:text-amber-600 hover:bg-amber-50 transition-colors"
            title="Mark as spam"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Answer form */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-background">
          <label className="text-xs font-semibold text-secondary block">
            {q.answer ? 'Edit answer' : 'Write an answer'}
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Write your answer here…"
            className="w-full border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
                className="w-4 h-4 accent-primary rounded"
              />
              Publish answer immediately
            </label>
            <div className="flex items-center gap-2">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !answer.trim()}
                className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save answer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

interface QaTabProps { productId: string }

export function QaTab({ productId }: QaTabProps) {
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [filter,    setFilter]      = useState<'all' | 'unanswered'>('all');
  const [loading,   setLoading]     = useState(true);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Question[]>(`${API_ROUTES.ADMIN.PRODUCT_QUESTIONS(productId)}?filter=${filter}`);
      setQuestions(safeArr(data));
    } catch { /* ignore */ }
    setLoading(false);
  }, [filter, productId]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const unanswered = questions.filter((q) => !q.answer).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-secondary">Customer Q&amp;A</h3>
          <p className="text-xs text-muted mt-0.5">Answer questions to reduce support messages and improve SEO.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === 'all' ? 'bg-primary text-white' : 'text-muted hover:text-secondary'}`}
          >
            All ({questions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unanswered')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === 'unanswered' ? 'bg-amber-500 text-white' : 'text-muted hover:text-secondary'}`}
          >
            Unanswered{unanswered > 0 ? ` (${unanswered})` : ''}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/10 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium text-secondary">No questions yet</p>
          <p className="text-xs mt-1">Customer questions will appear here once submitted.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionRow key={q.id} q={q} productId={productId} onRefresh={fetchQuestions} />
          ))}
        </div>
      )}
    </div>
  );
}
