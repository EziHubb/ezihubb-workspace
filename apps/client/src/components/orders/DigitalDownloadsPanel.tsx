'use client';

import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import type { OrderItemDto } from '@ezihubb/types';
import { API_BASE } from '../../lib/api-client';
import { useAuthStore } from '../../lib/store/auth.store';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Authenticated downloads need the bearer token attached manually — it lives
// in-memory (not a cookie the browser auto-sends), so a plain <a href> can't
// carry it. Guest orders instead authenticate via the ?email= query param, so
// those can just be a normal link.
function DownloadLink({ file, guestEmail }: { file: NonNullable<OrderItemDto['digitalFiles']>[number]; guestEmail?: string }) {
  const [downloading, setDownloading] = useState(false);
  const getToken = useAuthStore((s) => s.getToken);

  const url = guestEmail
    ? `${API_BASE}/api/v1${file.downloadUrl}?email=${encodeURIComponent(guestEmail)}`
    : `${API_BASE}/api/v1${file.downloadUrl}`;

  const handleClick = async (e: React.MouseEvent) => {
    if (guestEmail) return; // plain link, let the browser handle it
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setDownloading(true);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // best-effort — a failed download just does nothing; the button re-enables
    } finally {
      setDownloading(false);
    }
  };

  return (
    <li className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background">
      <FileText className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-secondary truncate">{file.filename}</p>
        <p className="text-xs text-muted">{formatBytes(file.sizeBytes)}</p>
      </div>
      <a
        href={url}
        onClick={handleClick}
        className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline shrink-0"
      >
        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Download
      </a>
    </li>
  );
}

export function DigitalDownloadsPanel({ items, guestEmail }: { items: OrderItemDto[]; guestEmail?: string }) {
  const files = items.flatMap((item) => item.digitalFiles ?? []);
  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-sm px-4 py-3">
        <Download className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-medium text-emerald-700">Your files are ready to download.</span>
      </div>
      <ul className="space-y-2">
        {files.map((f) => (
          <DownloadLink key={f.id} file={f} guestEmail={guestEmail} />
        ))}
      </ul>
      <p className="text-xs text-muted">
        Each file is licensed to this order only — please don&apos;t share or resell your download.
      </p>
    </div>
  );
}
