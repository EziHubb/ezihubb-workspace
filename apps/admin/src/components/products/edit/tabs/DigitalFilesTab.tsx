'use client';

import { useRef, useState } from 'react';
import { FileUp, FileText, Trash2, Loader2, GripVertical } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useDialog } from '../../../../contexts/DialogContext';
import type { DigitalFile } from '../types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadDigitalFiles(productId: string, files: File[]): Promise<DigitalFile[]> {
  const formData = new FormData();
  for (const f of files) formData.append('files', f);
  return api.post<DigitalFile[]>(API_ROUTES.ADMIN.PRODUCT_DIGITAL_FILES(productId), formData);
}

// There's no GET /admin/products/:id/digital-files endpoint — like images and
// print files, the list travels with the product itself (product.digitalFiles),
// so this tab takes the current list as a prop and reconciles it locally after
// each mutation, exactly like PhotoVideoTab does for imageIds.
export function DigitalFilesTab({ productId, digitalFiles }: { productId?: string; digitalFiles: DigitalFile[] }) {
  const { alert, confirm } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<DigitalFile[]>(digitalFiles);

  const sorted = [...files].sort((a, b) => a.sortOrder - b.sortOrder);

  const handlePick = async (fileList: FileList | null) => {
    if (!fileList || !productId) return;
    const picked = Array.from(fileList);
    setUploading(true);
    try {
      const created = await uploadDigitalFiles(productId, picked);
      setFiles((prev) => [...prev, ...created]);
    } catch (err) {
      await alert((err as Error).message || 'Upload failed.', { variant: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (file: DigitalFile) => {
    if (!productId) return;
    if (!await confirm(`Remove "${file.filename}"?`, { confirmLabel: 'Remove', destructive: true })) return;
    try {
      await api.delete(API_ROUTES.ADMIN.PRODUCT_DIGITAL_FILE_DELETE(productId, file.id));
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      // The server blocks the first attempt (409) when buyers already own this
      // file — surface that specific warning and let the admin explicitly
      // confirm again before permanently breaking their download.
      if (err instanceof ApiError && err.status === 409) {
        if (!await confirm(err.message, { confirmLabel: 'Delete anyway', destructive: true })) return;
        try {
          await api.delete(API_ROUTES.ADMIN.PRODUCT_DIGITAL_FILE_DELETE(productId, file.id), { params: { force: 'true' } });
          setFiles((prev) => prev.filter((f) => f.id !== file.id));
        } catch (err2) {
          await alert((err2 as Error).message || 'Could not remove the file.', { variant: 'error' });
        }
        return;
      }
      await alert((err as Error).message || 'Could not remove the file.', { variant: 'error' });
    }
  };

  if (!productId) {
    return (
      <div className="max-w-[1040px] mx-auto px-6 py-8">
        <p className="text-sm text-muted">Save the listing once before uploading digital files.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1040px] mx-auto px-6 py-8">
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <h3 className="font-semibold text-secondary">Digital files</h3>
          <p className="text-sm text-muted mt-0.5">
            The actual files buyers download after purchase — never shown publicly. Each file is
            stamped with the buyer&apos;s order number at download time to discourage sharing.
            Describe usage rights and licensing in your product description.
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            {sorted.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background">
                <GripVertical className="w-4 h-4 text-muted/50 shrink-0" />
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary truncate">{f.filename}</p>
                  <p className="text-xs text-muted">{f.mimeType} · {formatBytes(f.sizeBytes)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(f)}
                  className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-600 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {sorted.length === 0 && (
              <p className="text-sm text-muted text-center py-6">No digital files uploaded yet.</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-primary border border-dashed border-primary/40 hover:border-primary rounded-lg py-4 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {uploading ? 'Uploading…' : 'Upload files (max 50 MB each)'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handlePick(e.target.files)}
          />
        </div>
      </div>
    </div>
  );
}
