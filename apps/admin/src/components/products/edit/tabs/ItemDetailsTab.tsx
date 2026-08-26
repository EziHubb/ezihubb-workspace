'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import {
  Smile, Lightbulb, Sparkles, Check, X,
  AlertCircle, Package, Download,
} from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProductEditFormValues, ProductType } from '../types';
import { CategoryPickerCard } from '../CategoryPickerModal';

// ─── Emoji picker data ────────────────────────────────────────────────────────

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Stars & Hearts',
    emojis: ['⭐','✨','💫','🌟','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💗','💝'],
  },
  {
    label: 'Gestures',
    emojis: ['✅','☑️','✔️','👍','👏','🙌','🎉','🎊','🎁','🎀','🏆','🥇','💯','🔥','⚡'],
  },
  {
    label: 'Nature',
    emojis: ['🌸','🌺','🌻','🌹','🍀','🌿','🍃','🌱','🌲','🌈','☀️','🌙','⭐','🦋','🐝'],
  },
  {
    label: 'Objects',
    emojis: ['📦','🎨','✏️','📝','🔑','🏠','🛋️','🪴','🧴','🪡','🧵','🎭','🖼️','📸','💍'],
  },
  {
    label: 'Symbols',
    emojis: ['💎','🔮','🪩','🌀','♾️','🎯','📌','📍','💡','🔔','📣','ℹ️','➡️','⬇️','↩️'],
  },
];

// ─── Emoji picker ─────────────────────────────────────────────────────────────

function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick:  (e: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 z-30 w-[320px] max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-card shadow-lg overflow-hidden"
    >
      <div className="px-3 pt-3 pb-1 border-b border-border">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Insert emoji</p>
      </div>
      <div className="max-h-64 overflow-y-auto px-3 py-2 space-y-3">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1.5">{group.label}</p>
            <div className="flex flex-wrap gap-0.5">
              {group.emojis.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => { onPick(em); onClose(); }}
                  className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-muted/10 transition-colors"
                  title={em}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rich text description ────────────────────────────────────────────────────

const MAX_DESC = 15_000;

function RichTextDescription({
  value,
  onChange,
}: {
  value:    string;
  onChange: (v: string) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertEmoji = useCallback((emoji: string) => {
    const ta  = textareaRef.current;
    if (!ta) { onChange(value + emoji); return; }
    const start = ta.selectionStart ?? value.length;
    const end   = ta.selectionEnd   ?? value.length;
    const next  = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    // Restore cursor after emoji
    setTimeout(() => {
      ta.selectionStart = start + emoji.length;
      ta.selectionEnd   = start + emoji.length;
      ta.focus();
    }, 0);
  }, [value, onChange]);

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_DESC))}
        rows={10}
        placeholder={
          "Tell buyers what makes this item special. ✨\n\n" +
          "Describe:\n" +
          "• Materials and dimensions\n" +
          "• Personalisation options\n" +
          "• Care instructions\n" +
          "• What's included"
        }
        className="w-full px-3 py-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y placeholder:text-muted leading-relaxed"
        style={{ minHeight: 200 }}
      />

      {/* Footer row */}
      <div className="flex items-center justify-between relative">
        {/* Emoji picker trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji((s) => !s)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-button border transition-colors ${showEmoji ? 'border-primary/40 text-primary bg-primary/5' : 'border-border text-muted hover:border-primary/40 hover:text-primary'}`}
          >
            <Smile className="w-3.5 h-3.5" />
            Add emoji
          </button>
          {showEmoji && (
            <EmojiPicker
              onPick={insertEmoji}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </div>

        {/* Character count */}
        <span className={`text-xs tabular-nums font-mono ${value.length > MAX_DESC * 0.95 ? 'text-amber-600 font-semibold' : 'text-muted'}`}>
          {value.length.toLocaleString()}/{MAX_DESC.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// ─── Title tips ───────────────────────────────────────────────────────────────

function TitleTips({ wordCount }: { wordCount: number }) {
  return (
    <div className="mt-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
      <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">Tips to improve your title</p>
        <ul className="mt-1.5 space-y-1">
          {wordCount > 14 && (
            <li className="text-sm text-amber-700 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-amber-600 shrink-0" />
              Consider using 14 words or less (current: {wordCount} words)
            </li>
          )}
          <li className="text-sm text-amber-700 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-amber-600 shrink-0" />
            Start with the most important keywords buyers search for
          </li>
          <li className="text-sm text-amber-700 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-amber-600 shrink-0" />
            Include what it is, who it's for, and what makes it special
          </li>
        </ul>
      </div>
    </div>
  );
}

// ─── AI title suggestion ──────────────────────────────────────────────────────

function TitleSuggestionBanner({
  suggestion, onApply, onDismiss,
}: {
  suggestion: string;
  onApply:    () => void;
  onDismiss:  () => void;
}) {
  return (
    <div className="mt-3 flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary">Suggested</p>
        <p className="text-sm text-secondary mt-1 leading-relaxed">{suggestion}</p>
        <div className="flex items-center gap-4 mt-2">
          <button
            type="button"
            onClick={onApply}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Check className="w-3.5 h-3.5" /> Apply suggestion
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center gap-1 text-xs font-medium text-muted hover:text-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Discard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form field wrapper ───────────────────────────────────────────────────────

function FormField({
  label,
  required,
  hint,
  action,
  children,
}: {
  label:    string;
  required?: boolean;
  hint?:    string;
  /** Optional control rendered on the same row as the label (e.g. "Get title suggestion"). */
  action?:  React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <label className="block text-xs font-semibold text-muted uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {action}
      </div>
      {hint && <p className="text-xs text-muted mb-2">{hint}</p>}
      {children}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

const MAX_TITLE = 140;

export function ItemDetailsTab() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<ProductEditFormValues>();

  const title       = watch('name')               ?? '';
  const description = watch('description')        ?? '';
  const categoryId  = watch('primaryCategoryId')  ?? '';
  const productType = watch('productType')        ?? 'PHYSICAL';

  const wordCount = title.trim() ? title.trim().split(/\s+/).length : 0;

  // ── AI title suggestion — on-demand only (each call is a real LLM cost) ──────
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestion,     setSuggestion]     = useState<string | null>(null);
  const [suggestError,   setSuggestError]   = useState<string | null>(null);

  // The suggestion prompt asks for the category and the request DTO accepts it,
  // but nothing was sending it — so every suggestion was written without
  // knowing whether the item is an ornament or a t-shirt.
  //
  // Same query key CategoryPickerCard already uses, so this is served from the
  // react-query cache rather than being a second request for the same row.
  const { data: category } = useQuery<{ name: string }>({
    queryKey: ['category', categoryId],
    queryFn:  () => api.get<{ name: string }>(API_ROUTES.ADMIN.CATEGORY(categoryId)),
    enabled:  !!categoryId,
  });

  const fetchTitleSuggestion = async () => {
    setSuggestLoading(true);
    setSuggestError(null);
    setSuggestion(null);
    try {
      const res = await api.post<{ suggestedTitle: string }>(
        API_ROUTES.ADMIN.PRODUCT_TITLE_SUGGESTION,
        {
          name:         title.trim(),
          description:  description || undefined,
          categoryName: category?.name || undefined,
        },
      );
      setSuggestion(res.suggestedTitle);
    } catch (e: unknown) {
      setSuggestError((e as Error).message || 'Could not get a suggestion right now.');
    } finally {
      setSuggestLoading(false);
    }
  };

  const applyTitleSuggestion = () => {
    if (!suggestion) return;
    // shouldValidate — without it, a stale "must be ≤140 characters" error
    // (from the over-length title that triggered fetching a suggestion in
    // the first place) would keep showing even after the new, backend-
    // truncated title is applied, since setValue alone doesn't re-run
    // register('name')'s validation.
    setValue('name', suggestion, { shouldDirty: true, shouldValidate: true });
    setSuggestion(null);
  };

  return (
    <div className="max-w-[1040px] mx-auto px-6 py-8">
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
        {/* Section header */}
        <div className="px-6 py-5 border-b border-border">
          <h3 className="font-semibold text-secondary">Item details</h3>
          <p className="text-sm text-muted mt-0.5">
            Help buyers understand your item better, and share any special options you offer.
          </p>
        </div>

        <div className="px-6 py-5 space-y-7">
          {/* ── Product type ─────────────────────────────────────────────── */}
          <FormField
            label="Product type"
            hint="Digital products are delivered as instant downloads — no shipping, no fulfillment pipeline."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { value: 'PHYSICAL', label: 'Physical product', sub: 'Shipped to the buyer', icon: Package },
                { value: 'DIGITAL',  label: 'Digital download',  sub: 'Instant file delivery', icon: Download },
              ] as { value: ProductType; label: string; sub: string; icon: typeof Package }[]).map(({ value, label, sub, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('productType', value, { shouldDirty: true })}
                  className={[
                    'flex items-start gap-3 px-4 py-3.5 rounded-lg border-2 text-left transition-colors',
                    productType === value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                  ].join(' ')}
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${productType === value ? 'text-primary' : 'text-muted'}`} />
                  <div>
                    <p className="text-sm font-semibold text-secondary">{label}</p>
                    <p className="text-xs text-muted mt-0.5">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </FormField>

          {/* ── Category ─────────────────────────────────────────────────── */}
          <FormField
            label="Selected category"
            required
            hint="Choose the most specific category that describes your item."
          >
            <CategoryPickerCard
              value={categoryId}
              onChange={(id) => setValue('primaryCategoryId', id, { shouldDirty: true })}
            />
            {errors.primaryCategoryId && (
              <p className="mt-1 text-xs text-red-600">{errors.primaryCategoryId.message as string}</p>
            )}
            {/* Hidden register for validation */}
            <input
              type="hidden"
              {...register('primaryCategoryId', { required: 'Please select a category' })}
            />
          </FormField>

          {/* ── Title ────────────────────────────────────────────────────── */}
          <FormField
            label="Title"
            required
            hint="Make sure your title is easy to understand and clearly describes what you're selling."
            action={
              <button
                type="button"
                onClick={fetchTitleSuggestion}
                disabled={!title.trim() || suggestLoading}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-button px-2.5 py-1.5 hover:bg-primary/5 disabled:opacity-40 transition-colors shrink-0"
              >
                {suggestLoading ? (
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {suggestLoading ? 'Thinking…' : 'Get title suggestion'}
              </button>
            }
          >
            <div className="relative">
              <textarea
                {...register('name', {
                  required:  'Title is required',
                  maxLength: { value: MAX_TITLE, message: `Title must be ${MAX_TITLE} characters or fewer` },
                })}
                rows={3}
                placeholder="e.g. Custom Photo Mug — Personalised Gift for Coffee Lovers ☕"
                className={[
                  'w-full px-3 py-3 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 resize-none leading-relaxed placeholder:text-muted transition-colors',
                  errors.name
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-border focus:ring-primary/20',
                ].join(' ')}
              />
              {/* Character counter overlay */}
              <span
                className={[
                  'absolute bottom-2.5 right-3 text-xs font-mono pointer-events-none',
                  title.length > MAX_TITLE
                    ? 'text-red-600 font-bold'
                    : title.length > MAX_TITLE * 0.9
                      ? 'text-amber-600'
                      : 'text-muted',
                ].join(' ')}
              >
                {title.length}/{MAX_TITLE}
              </span>
            </div>

            {/* Inline validation error */}
            {errors.name && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {errors.name.message as string}
              </p>
            )}

            {/* AI title suggestion */}
            {suggestion && (
              <TitleSuggestionBanner
                suggestion={suggestion}
                onApply={applyTitleSuggestion}
                onDismiss={() => setSuggestion(null)}
              />
            )}
            {suggestError && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {suggestError}
              </p>
            )}

            {/* Conditional title tips */}
            {wordCount > 14 && <TitleTips wordCount={wordCount} />}
          </FormField>

          {/* ── Description ──────────────────────────────────────────────── */}
          <FormField
            label="Description"
            hint="Buyers will only see the first few lines unless they expand. Lead with the most important information."
          >
            <RichTextDescription
              value={description}
              onChange={(v) => setValue('description', v, { shouldDirty: true })}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
