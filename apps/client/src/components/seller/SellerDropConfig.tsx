'use client';
import { useState } from 'react';
import { apiClient } from '@mlh/api-client';

interface SellerDropConfigProps {
  productId: string;
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

  return (
    <form onSubmit={handleSave} className="rounded-lg border bg-white p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">Drop Configuration</h3>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isDrop}
          onChange={e => setIsDrop(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-purple-600"
        />
        <span className="text-sm text-gray-700">Enable Drop Mode for this product</span>
      </label>
      {isDrop && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Launch Date &amp; Time</label>
              <input
                type="datetime-local"
                value={launchAt}
                onChange={e => setLaunchAt(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date (optional)</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={e => setEndAt(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity Limit (optional)</label>
            <input
              type="number"
              min="1"
              value={quantityLimit}
              onChange={e => setQuantityLimit(e.target.value)}
              placeholder="Leave blank for unlimited"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={waitlistOpen}
              onChange={e => setWaitlistOpen(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-purple-600"
            />
            <span className="text-sm text-gray-700">Accept waitlist sign-ups before launch</span>
          </label>
        </>
      )}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Drop Config'}
      </button>
    </form>
  );
}
