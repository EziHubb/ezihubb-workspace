'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Wand2, Upload, Trash2, Check, X, Loader2, ImageIcon } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProductImage, PrintSide } from '../types';

const SIDES: { value: PrintSide; label: string }[] = [
  { value: 'FRONT',  label: 'Front' },
  { value: 'BACK',   label: 'Back' },
  { value: 'SLEEVE', label: 'Sleeve' },
  { value: 'HOOD',   label: 'Hood' },
];

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

type SideState =
  | { phase: 'idle' }
  | { phase: 'picking' }
  | { phase: 'generating'; jobId: string }
  | { phase: 'reviewing'; processedUrl: string; processedKey: string }
  | { phase: 'error'; message: string };

async function presignAndUpload(file: File): Promise<string> {
  const [presigned] = await api.post<{ presignedUrl: string; publicUrl: string; key: string }[]>(
    API_ROUTES.ADMIN.ASSETS_PRESIGN,
    { files: [{ name: file.name, mimeType: file.type }] },
  );
  const res = await fetch(presigned.presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${file.name}`);
  return presigned.publicUrl;
}

function SourcePhotoPicker({ mockups, onPick, onClose }: {
  mockups: ProductImage[];
  onPick:  (imageId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h4 className="font-semibold text-secondary">Choose the source photo</h4>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="px-5 pt-3 text-xs text-muted">Pick the photo that clearly shows the design — skip size charts or lifestyle shots.</p>
        <div className="p-5 grid grid-cols-3 gap-3 max-h-80 overflow-y-auto">
          {mockups.length === 0 && (
            <p className="col-span-3 text-sm text-muted text-center py-6">This product has no photos yet — add one in the Photo tab first.</p>
          )}
          {mockups.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onPick(img.id)}
              className="aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors"
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PrintFileSlot({ productId, side, label, existing, mockups, onChanged }: {
  productId: string;
  side:      PrintSide;
  label:     string;
  existing:  ProductImage | undefined;
  mockups:   ProductImage[];
  onChanged: () => void;
}) {
  const [state, setState] = useState<SideState>({ phase: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollTimer.current) clearInterval(pollTimer.current); }, []);

  const startGeneration = async (sourceImageId: string) => {
    setState({ phase: 'generating', jobId: '' });
    try {
      const { jobId } = await api.post<{ jobId: string }>(
        API_ROUTES.ADMIN.PRODUCT_PRINT_FILE_GENERATE(productId),
        { sourceImageId, printSide: side },
      );
      setState({ phase: 'generating', jobId });

      const startedAt = Date.now();
      pollTimer.current = setInterval(async () => {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setState({ phase: 'error', message: 'Generation timed out — try again.' });
          return;
        }
        try {
          const job = await api.get<{ status: string; processedUrl?: string; processedKey?: string; error?: string }>(
            API_ROUTES.ADMIN.PRODUCT_PRINT_FILE_JOB(productId, jobId),
          );
          if (job.status === 'done' && job.processedUrl && job.processedKey) {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setState({ phase: 'reviewing', processedUrl: job.processedUrl, processedKey: job.processedKey });
          } else if (job.status === 'failed') {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setState({ phase: 'error', message: job.error ?? 'Background removal failed.' });
          }
        } catch {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setState({ phase: 'error', message: 'Lost track of the generation job — try again.' });
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setState({ phase: 'error', message: (err as Error).message || 'Could not start generation.' });
    }
  };

  const approve = async () => {
    if (state.phase !== 'reviewing') return;
    await api.post(API_ROUTES.ADMIN.PRODUCT_PRINT_FILE_APPROVE(productId, side), { processedKey: state.processedKey });
    setState({ phase: 'idle' });
    onChanged();
  };

  const handleManualUpload = async (file: File) => {
    setState({ phase: 'generating', jobId: '' }); // reuse the busy spinner
    try {
      const url = await presignAndUpload(file);
      await api.post(API_ROUTES.ADMIN.PRODUCT_PRINT_FILES(productId), { url, printSide: side });
      setState({ phase: 'idle' });
      onChanged();
    } catch (err) {
      setState({ phase: 'error', message: (err as Error).message || 'Upload failed.' });
    }
  };

  const remove = async () => {
    if (!confirm(`Remove the ${label} print file?`)) return;
    await api.delete(API_ROUTES.ADMIN.PRODUCT_PRINT_FILE_DELETE(productId, side));
    onChanged();
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-secondary uppercase tracking-wide">{label}</p>

      {existing && state.phase === 'idle' && (
        <div className="space-y-2">
          <div className="aspect-square rounded-lg overflow-hidden border border-border bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
            <img src={existing.url} alt="" className="w-full h-full object-contain" />
          </div>
          <button type="button" onClick={remove} className="w-full flex items-center justify-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 py-1.5 rounded-button hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      )}

      {!existing && state.phase === 'idle' && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setState({ phase: 'picking' })}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary border border-dashed border-primary/40 hover:border-primary rounded-button py-2.5"
          >
            <Wand2 className="w-3.5 h-3.5" /> Generate from photo
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-muted hover:text-secondary border border-border rounded-button py-2"
          >
            <Upload className="w-3.5 h-3.5" /> Upload a design file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleManualUpload(f); e.target.value = ''; }}
          />
        </div>
      )}

      {state.phase === 'picking' && (
        <SourcePhotoPicker
          mockups={mockups}
          onClose={() => setState({ phase: 'idle' })}
          onPick={(imageId) => void startGeneration(imageId)}
        />
      )}

      {state.phase === 'generating' && (
        <div className="aspect-square rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p className="text-xs">Removing background…</p>
        </div>
      )}

      {state.phase === 'reviewing' && (
        <div className="space-y-2">
          <div className="aspect-square rounded-lg overflow-hidden border border-border bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
            <img src={state.processedUrl} alt="Preview" className="w-full h-full object-contain" />
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={approve} className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-white bg-primary hover:bg-primary-dark rounded-button py-2">
              <Check className="w-3.5 h-3.5" /> Approve
            </button>
            <button type="button" onClick={() => setState({ phase: 'picking' })} className="flex-1 text-xs font-medium text-muted border border-border rounded-button py-2 hover:text-secondary">
              Try another photo
            </button>
          </div>
          <p className="text-[11px] text-muted flex items-center gap-1"><ImageIcon className="w-3 h-3 shrink-0" /> Review closely — this is what gets printed.</p>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="space-y-2">
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-button px-2.5 py-2">{state.message}</p>
          <button type="button" onClick={() => setState({ phase: 'idle' })} className="w-full text-xs font-medium text-muted border border-border rounded-button py-2 hover:text-secondary">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

export function PrintFilesSection({ productId, images }: { productId: string; images: ProductImage[] }) {
  const qc = useQueryClient();
  const mockups = images.filter((i) => i.type === 'MOCKUP');
  const printFilesBySide = Object.fromEntries(
    images.filter((i) => i.type === 'PRINT_FILE' && i.printSide).map((i) => [i.printSide as PrintSide, i]),
  ) as Partial<Record<PrintSide, ProductImage>>;

  const handleChanged = () => {
    void qc.invalidateQueries({ queryKey: ['admin-product', productId] });
  };

  return (
    <div>
      <p className="text-xs text-muted mb-4">
        A print file is the isolated design artwork Merchize prints — not a photo of the finished product.
        Generate one from an existing photo (background removed automatically) or upload a real design file if you have one.
        Print files are never shown to shoppers.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SIDES.map((s) => (
          <PrintFileSlot
            key={s.value}
            productId={productId}
            side={s.value}
            label={s.label}
            existing={printFilesBySide[s.value]}
            mockups={mockups}
            onChanged={handleChanged}
          />
        ))}
      </div>
    </div>
  );
}
