'use client';

import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@mlh/api-client';

interface SellerDropConfigProps {
  productId:   string;
  currentDrop?: {
    dropLaunchAt:      string | null;
    dropQuantityLimit: number | null;
    dropWaitlistOpen:  boolean;
    dropEndAt:         string | null;
    isDrop:            boolean;
  };
  onSaved?: () => void;
}

export function SellerDropConfig({ productId, currentDrop, onSaved }: SellerDropConfigProps) {
  const [expanded,      setExpanded]      = useState(currentDrop?.isDrop ?? false);
  const [isDrop,        setIsDrop]        = useState(currentDrop?.isDrop ?? false);
  const [launchAt,      setLaunchAt]      = useState(currentDrop?.dropLaunchAt?.slice(0, 16) ?? '');
  const [endAt,         setEndAt]         = useState(currentDrop?.dropEndAt?.slice(0, 16)    ?? '');
  const [quantityLimit, setQuantityLimit] = useState(currentDrop?.dropQuantityLimit?.toString() ?? '');
  const [waitlistOpen,  setWaitlistOpen]  = useState(currentDrop?.dropWaitlistOpen ?? true);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch(`/seller/products/${productId}/drops`, {
        isDrop,
        dropLaunchAt:      launchAt     ? new Date(launchAt).toISOString() : null,
        dropEndAt:         endAt        ? new Date(endAt).toISOString()    : null,
        dropQuantityLimit: quantityLimit ? parseInt(quantityLimit)          : null,
        dropWaitlistOpen:  waitlistOpen,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDrop = (checked: boolean) => {
    setIsDrop(checked);
    if (checked) setExpanded(true);
  };

  const launchPreview = launchAt
    ? new Date(launchAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + new Date(launchAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E8E4DF' }}>
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-4 text-left transition-colors hover:bg-gray-50"
        style={{ background: '#FAFAF8' }}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-gray-900 text-sm">Launch as a drop</span>
          {isDrop && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ background: '#F59E0B' }}
            >
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle switch */}
          <div
            onClick={(e) => { e.stopPropagation(); handleToggleDrop(!isDrop); }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer`}
            style={{ background: isDrop ? '#F59E0B' : '#D1D5DB' }}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isDrop ? 'translate-x-4' : 'translate-x-0.5'}`}
            />
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Panel body */}
      {expanded && (
        <form onSubmit={handleSave} className="bg-white px-4 pb-4 pt-4 space-y-4 border-t" style={{ borderColor: '#E8E4DF' }}>
          {/* Launch date row */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Launch date &amp; time</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="datetime-local"
                value={launchAt}
                onChange={e => setLaunchAt(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#E8E4DF' }}
              />
              <input
                type="datetime-local"
                value={endAt}
                onChange={e => setEndAt(e.target.value)}
                placeholder="End date (optional)"
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#E8E4DF' }}
              />
            </div>
            {launchPreview && (
              <p className="text-xs font-medium" style={{ color: '#E85D3F' }}>
                Launches: {launchPreview}
              </p>
            )}
          </div>

          {/* Quantity limit row */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-700">Quantity limit</label>
              <span className="text-xs text-gray-400">Optional</span>
            </div>
            <input
              type="number"
              min="1"
              value={quantityLimit}
              onChange={e => setQuantityLimit(e.target.value)}
              placeholder="Leave blank for unlimited"
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#E8E4DF' }}
            />
          </div>

          {/* Waitlist toggle row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-700">Enable waitlist signup</p>
              <p className="text-xs text-gray-400 mt-0.5">Buyers can join before launch — emailed at launch</p>
            </div>
            <div
              onClick={() => setWaitlistOpen(v => !v)}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0"
              style={{ background: waitlistOpen ? '#F59E0B' : '#D1D5DB' }}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${waitlistOpen ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </div>
          </div>

          {/* Preview box */}
          {isDrop && launchAt && (
            <div className="rounded-xl p-3.5" style={{ background: '#FFF0EC' }}>
              <p className="text-xs text-gray-500 mb-1">Preview:</p>
              <p className="text-xs text-gray-700">
                Your product will be hidden until {launchPreview}.{' '}
                {waitlistOpen ? 'Waitlist subscribers will receive an email blast at launch.' : ''}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#E85D3F' }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save drop settings'}
          </button>
        </form>
      )}
    </div>
  );
}
