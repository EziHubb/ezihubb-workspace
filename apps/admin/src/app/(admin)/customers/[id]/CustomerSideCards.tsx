'use client';

import { useState } from 'react';
import { Plus, X, Save } from 'lucide-react';
import { format } from 'date-fns';
import { clientFetch } from '../../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomerNote {
  id:        string;
  body:      string;
  createdAt: string;
  authorName?: string;
}

export interface CustomerAddress {
  id:           string;
  fullName:     string;
  addressLine1: string;
  addressLine2?: string;
  city:         string;
  state?:       string;
  postalCode:   string;
  country:      string;
  isDefault:    boolean;
}

interface Props {
  customerId: string;
  notes:      CustomerNote[];
  tags:       string[];
  addresses:  CustomerAddress[];
}

// ── Notes card ────────────────────────────────────────────────────────────────

function NotesCard({ customerId, initialNotes }: { customerId: string; initialNotes: CustomerNote[] }) {
  const [notes,   setNotes]   = useState<CustomerNote[]>(initialNotes);
  const [text,    setText]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res  = await clientFetch(`/admin/customers/${customerId}/notes`, {
        method: 'POST',
        body:   JSON.stringify({ body: text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Failed to save note');
      const note = (body.data ?? body) as CustomerNote;
      setNotes((n) => [note, ...n]);
      setText('');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-4 space-y-3">
      <h5 className="font-semibold text-secondary text-sm">Notes</h5>

      {/* Existing notes */}
      {notes.length > 0 ? (
        <ul className="space-y-2.5 max-h-52 overflow-y-auto pr-0.5">
          {notes.map((n) => (
            <li key={n.id} className="text-sm">
              <p className="text-secondary/80 italic leading-snug">"{n.body}"</p>
              <p className="text-[11px] text-muted mt-0.5">
                {n.authorName ?? 'Admin'} · {format(new Date(n.createdAt), 'MMM d, yyyy')}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted italic">No notes yet.</p>
      )}

      {/* Add note */}
      <div className="space-y-2 pt-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Add a note…"
          className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className="flex items-center gap-1.5 text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/5 px-3 py-1.5 rounded-button transition-colors disabled:opacity-40"
        >
          <Save className="w-3 h-3" />
          {saving ? 'Saving…' : 'Save Note'}
        </button>
      </div>
    </div>
  );
}

// ── Tags card ─────────────────────────────────────────────────────────────────

function TagsCard({ customerId, initialTags }: { customerId: string; initialTags: string[] }) {
  const [tags,    setTags]    = useState<string[]>(initialTags);
  const [input,   setInput]   = useState('');
  const [saving,  setSaving]  = useState(false);

  const sync = async (updated: string[]) => {
    setSaving(true);
    try {
      await clientFetch(`/admin/customers/${customerId}/tags`, {
        method: 'PATCH',
        body:   JSON.stringify({ tags: updated }),
      });
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const addTag = () => {
    const t = input.trim();
    if (!t || tags.includes(t)) { setInput(''); return; }
    const updated = [...tags, t];
    setTags(updated);
    setInput('');
    sync(updated);
  };

  const removeTag = (t: string) => {
    const updated = tags.filter((x) => x !== t);
    setTags(updated);
    sync(updated);
  };

  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-4 space-y-3">
      <h5 className="font-semibold text-secondary text-sm flex items-center justify-between">
        Tags
        {saving && <span className="text-[10px] text-muted font-normal animate-pulse">saving…</span>}
      </h5>

      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && <p className="text-xs text-muted italic">No tags.</p>}
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/8 text-primary text-xs font-semibold rounded-full"
          >
            {t}
            <button type="button" onClick={() => removeTag(t)} className="hover:text-primary-dark transition-colors">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>

      {/* Add tag */}
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          placeholder="Add tag…"
          className="flex-1 px-2.5 py-1.5 text-xs border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={!input.trim()}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-button transition-colors disabled:opacity-40"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>
    </div>
  );
}

// ── Addresses card ────────────────────────────────────────────────────────────

function AddressesCard({ addresses }: { addresses: CustomerAddress[] }) {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-4 space-y-3">
      <h5 className="font-semibold text-secondary text-sm">
        Addresses ({addresses.length})
      </h5>

      {addresses.length === 0 ? (
        <p className="text-xs text-muted italic">No saved addresses.</p>
      ) : (
        <ul className="space-y-2.5">
          {addresses.map((a) => (
            <li key={a.id} className="text-xs text-muted leading-snug">
              {a.isDefault && (
                <span className="inline-block bg-green-50 text-green-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-0.5">
                  Default
                </span>
              )}
              <p className="font-medium text-secondary text-sm leading-none mb-0.5">{a.fullName}</p>
              <p>{a.addressLine1}{a.addressLine2 ? `, ${a.addressLine2}` : ''}</p>
              <p>{a.city}{a.state ? `, ${a.state}` : ''} {a.postalCode} · {a.country}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Composed export ───────────────────────────────────────────────────────────

export function CustomerSideCards({ customerId, notes, tags, addresses }: Props) {
  return (
    <div className="space-y-4">
      <NotesCard     customerId={customerId} initialNotes={notes}     />
      <TagsCard      customerId={customerId} initialTags={tags}       />
      <AddressesCard addresses={addresses}                            />
    </div>
  );
}
