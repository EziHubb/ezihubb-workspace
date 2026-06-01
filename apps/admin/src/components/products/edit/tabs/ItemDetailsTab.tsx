'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import {
  X, ChevronRight, Check, Smile, Lightbulb, Tag,
  AlertCircle, Search,
} from 'lucide-react';
import { clientFetch } from '../../../../lib/api';
import type { ProductEditFormValues } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id:        string;
  name:      string;
  slug:      string;
  level:     number;
  parentId?: string | null;
  isVisible?: boolean;
}

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
      className="absolute bottom-full left-0 mb-2 z-30 w-[320px] bg-surface border border-border rounded-card shadow-lg overflow-hidden"
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

// ─── Category picker modal ────────────────────────────────────────────────────

function CategoryPickerModal({
  currentId,
  onSelect,
  onClose,
}: {
  currentId: string;
  onSelect:  (id: string) => void;
  onClose:   () => void;
}) {
  const [searchQ,     setSearchQ]     = useState('');
  const [selectedL1,  setSelectedL1]  = useState<string | null>(null);
  const [selectedL2,  setSelectedL2]  = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string>(currentId);

  // Fetch ALL categories in one call and build tree client-side
  const { data: allCats = [], isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories-all'],
    queryFn:  async () => {
      const res  = await clientFetch('/catalog/categories?limit=500');
      const body = await res.json();
      const raw  = body.data ?? body;
      return (Array.isArray(raw) ? raw : []) as Category[];
    },
    staleTime: 10 * 60_000,
  });

  const l1s = allCats.filter((c) => c.level === 1 && c.isVisible !== false);
  const l2s = selectedL1 ? allCats.filter((c) => c.level === 2 && c.parentId === selectedL1) : [];
  const l3s = selectedL2 ? allCats.filter((c) => c.level === 3 && c.parentId === selectedL2) : [];

  // Search results: all L3 categories matching the query
  const searchResults = searchQ.length > 1
    ? allCats.filter(
        (c) => c.level === 3 &&
          c.name.toLowerCase().includes(searchQ.toLowerCase()),
      ).slice(0, 20)
    : [];

  // Auto-expand to current category on open
  useEffect(() => {
    if (!currentId || !allCats.length) return;
    const l3  = allCats.find((c) => c.id === currentId);
    if (!l3) return;
    const l2  = allCats.find((c) => c.id === l3.parentId);
    if (l2) {
      setSelectedL2(l2.id);
      const l1 = allCats.find((c) => c.id === l2.parentId);
      if (l1) setSelectedL1(l1.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, allCats.length]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleL3Click = (id: string) => {
    setHighlighted(id);
    onSelect(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[680px] flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold text-secondary">Select a category</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search categories…"
              autoFocus
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {searchQ.length > 1 ? (
            /* Search results */
            <div className="overflow-y-auto h-full px-5 py-3">
              {isLoading ? (
                <p className="text-sm text-muted text-center py-6">Loading…</p>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">No categories found for "{searchQ}"</p>
              ) : (
                <ul className="space-y-0.5">
                  {searchResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => handleL3Click(c.id)}
                        className={[
                          'w-full flex items-center justify-between px-3 py-2 text-sm rounded-button transition-colors text-left',
                          highlighted === c.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-muted/5 text-secondary',
                        ].join(' ')}
                      >
                        <span>{c.name}</span>
                        {highlighted === c.id && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            /* 3-column breadcrumb tree */
            <div className="flex divide-x divide-border h-full overflow-hidden">
              {/* L1 */}
              <div className="w-1/3 overflow-y-auto py-2">
                {isLoading
                  ? <div className="px-4 py-3 text-sm text-muted">Loading…</div>
                  : l1s.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedL1(c.id); setSelectedL2(null); }}
                        className={[
                          'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                          selectedL1 === c.id
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-secondary hover:bg-muted/5',
                        ].join(' ')}
                      >
                        <span className="truncate">{c.name}</span>
                        {selectedL1 === c.id && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
              </div>

              {/* L2 */}
              <div className="w-1/3 overflow-y-auto py-2 bg-muted/3">
                {!selectedL1 ? (
                  <p className="px-4 py-3 text-xs text-muted italic">Select a top-level category</p>
                ) : l2s.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted italic">No sub-categories</p>
                ) : l2s.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedL2(c.id)}
                      className={[
                        'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                        selectedL2 === c.id
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-secondary hover:bg-muted/5',
                      ].join(' ')}
                    >
                      <span className="truncate">{c.name}</span>
                      {selectedL2 === c.id && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))
                }
              </div>

              {/* L3 — selectable */}
              <div className="w-1/3 overflow-y-auto py-2">
                {!selectedL2 ? (
                  <p className="px-4 py-3 text-xs text-muted italic">Select a sub-category</p>
                ) : l3s.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted italic">No leaf categories</p>
                ) : l3s.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleL3Click(c.id)}
                      className={[
                        'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left rounded-r-none transition-colors',
                        highlighted === c.id
                          ? 'bg-primary text-white font-semibold'
                          : currentId === c.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-secondary hover:bg-muted/5',
                      ].join(' ')}
                    >
                      {highlighted === c.id
                        ? <Check className="w-3.5 h-3.5 shrink-0" />
                        : <span className="w-3.5 h-3.5 shrink-0" />
                      }
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Category picker card ─────────────────────────────────────────────────────

function CategoryPickerCard({
  value,
  onChange,
  allCats,
  error,
}: {
  value:   string;
  onChange:(id: string) => void;
  allCats: Category[];
  error?:  string;
}) {
  const [showModal, setShowModal] = useState(false);

  const selected = allCats.find((c) => c.id === value);
  const parent   = selected?.parentId ? allCats.find((c) => c.id === selected.parentId) : null;
  const grandPar = parent?.parentId    ? allCats.find((c) => c.id === parent.parentId)    : null;

  // Build breadcrumb: L1 > L2 > L3
  const breadcrumb = [grandPar?.name, parent?.name, selected?.name]
    .filter(Boolean)
    .join(' › ');

  return (
    <>
      <div
        className={[
          'flex items-center gap-4 px-4 py-3.5 rounded-lg border-2 transition-colors',
          error ? 'border-red-300 bg-red-50' : selected ? 'border-border bg-background' : 'border-dashed border-border bg-background',
        ].join(' ')}
      >
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-sm font-semibold text-secondary truncate">{selected.name}</p>
              </div>
              {breadcrumb && (
                <p className="text-xs text-muted mt-0.5 truncate">{breadcrumb}</p>
              )}
              <p className="text-xs text-muted/60 mt-0.5">Physical item</p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm">No category selected</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="shrink-0 text-sm font-semibold text-primary hover:underline focus:outline-none"
        >
          {selected ? 'Change' : 'Select'}
        </button>
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}

      {showModal && (
        <CategoryPickerModal
          currentId={value}
          onSelect={onChange}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Form field wrapper ───────────────────────────────────────────────────────

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label:    string;
  required?: boolean;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
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

  const wordCount = title.trim() ? title.trim().split(/\s+/).length : 0;

  // Single shared query — CategoryPickerCard also uses it for breadcrumb
  const { data: allCats = [] } = useQuery<Category[]>({
    queryKey: ['admin-categories-all'],
    queryFn:  async () => {
      const res  = await clientFetch('/catalog/categories?limit=500');
      const body = await res.json();
      const raw  = body.data ?? body;
      return (Array.isArray(raw) ? raw : []) as Category[];
    },
    staleTime: 10 * 60_000,
  });

  return (
    <div className="max-w-[760px] mx-auto px-6 py-8">
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
        {/* Section header */}
        <div className="px-6 py-5 border-b border-border">
          <h3 className="font-semibold text-secondary">Item details</h3>
          <p className="text-sm text-muted mt-0.5">
            Help buyers understand your item better, and share any special options you offer.
          </p>
        </div>

        <div className="px-6 py-5 space-y-7">
          {/* ── Category ─────────────────────────────────────────────────── */}
          <FormField
            label="Selected category"
            required
            hint="Choose the most specific category that describes your item."
          >
            <CategoryPickerCard
              value={categoryId}
              onChange={(id) => setValue('primaryCategoryId', id, { shouldDirty: true })}
              allCats={allCats}
              error={errors.primaryCategoryId?.message as string | undefined}
            />
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
