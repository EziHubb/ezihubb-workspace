'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { getSession } from 'next-auth/react';
import { ArrowLeft, Upload, FileText, Download, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { API_BASE } from '../../../../lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ValidationError {
  row:     number;
  column:  string;
  message: string;
}

interface PreviewRow {
  row:          number;
  name:         string;
  status:       string;
  categorySlug: string;
  basePrice:    number;
  tags:         string[];
}

interface ValidationResult {
  totalRows:   number;
  validRows:   number;
  invalidRows: number;
  errors:      ValidationError[];
  preview:     PreviewRow[];
}

interface ImportResult {
  imported: number;
  updated:  number;
  failed:   number;
  errors:   Array<{ row: number; message: string }>;
}

type Stage = 'idle' | 'validating' | 'validated' | 'importing' | 'done';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadCsv(endpoint: string, file: File): Promise<Response> {
  const session = await getSession();
  const token   = (session?.user as Record<string, unknown> | undefined)?.['accessToken'] as string | undefined;

  const form = new FormData();
  form.append('file', file);

  return fetch(`${API_BASE}/admin/products/import/${endpoint}`, {
    method:  'POST',
    body:    form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function downloadTemplate(): Promise<void> {
  const session = await getSession();
  const token   = (session?.user as Record<string, unknown> | undefined)?.['accessToken'] as string | undefined;

  const res = await fetch(`${API_BASE}/admin/products/import/template`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'products-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  DRAFT:    'bg-gray-100 text-gray-600',
  INACTIVE: 'bg-yellow-100 text-yellow-700',
  ARCHIVED: 'bg-red-100 text-red-600',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductImportPage() {
  const [stage,    setStage]    = useState<Stage>('idle');
  const [file,     setFile]     = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [result,     setResult]     = useState<ImportResult | null>(null);
  const [error,      setError]      = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) {
      setError('Please upload a .csv file');
      return;
    }
    setFile(f);
    setValidation(null);
    setResult(null);
    setError('');
    setStage('idle');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleValidate = async () => {
    if (!file) return;
    setStage('validating');
    setError('');
    try {
      const res  = await uploadCsv('validate', file);
      const body = await res.json() as { success?: boolean; data?: ValidationResult } | ValidationResult;
      // unwrap TransformInterceptor envelope if present
      const data = 'data' in body && body.data ? body.data : body as ValidationResult;
      setValidation(data);
      setStage('validated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
      setStage('idle');
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setStage('importing');
    setError('');
    try {
      const res  = await uploadCsv('execute', file);
      const body = await res.json() as { success?: boolean; data?: ImportResult } | ImportResult;
      const data = 'data' in body && body.data ? body.data : body as ImportResult;
      setResult(data);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStage('validated');
    }
  };

  const reset = () => {
    setFile(null);
    setValidation(null);
    setResult(null);
    setError('');
    setStage('idle');
  };

  return (
    <>
      <AdminPageHeader
        title="Import Products"
        subtitle="Bulk-import products from a CSV file"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-button text-sm font-semibold text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
            <Link
              href="/products"
              className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-button text-sm font-semibold text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Products
            </Link>
          </div>
        }
        queryKey={false}
      />

      <div className="max-w-4xl space-y-6">

        {/* ── Drop zone ────────────────────────────────────────────────────── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragging ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:border-primary/50'
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-10 h-10 text-primary" />
              <p className="text-sm font-semibold text-secondary">{file.name}</p>
              <p className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-10 h-10 text-muted" />
              <p className="text-sm font-semibold text-secondary">Drop your CSV here, or click to browse</p>
              <p className="text-xs text-muted">Max 1,000 rows · UTF-8 or UTF-8 BOM</p>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        {file && stage !== 'done' && (
          <div className="flex items-center gap-3">
            {(stage === 'idle' || stage === 'validated') && (
              <button
                type="button"
                onClick={handleValidate}
                className="flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-secondary/90 text-white text-sm font-semibold rounded-button transition-colors"
              >
                Validate CSV
              </button>
            )}

            {stage === 'validating' && (
              <button disabled className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white text-sm font-semibold rounded-button opacity-70 cursor-not-allowed">
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating…
              </button>
            )}

            {stage === 'validated' && validation && validation.validRows > 0 && validation.errors.length === 0 && (
              <button
                type="button"
                onClick={handleImport}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-button transition-colors"
              >
                Import {validation.validRows} Products
              </button>
            )}

            {stage === 'importing' && (
              <button disabled className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-button opacity-70 cursor-not-allowed">
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing…
              </button>
            )}

            <button
              type="button"
              onClick={reset}
              className="text-sm text-muted hover:text-secondary transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* ── Validation results ────────────────────────────────────────────── */}
        {validation && stage === 'validated' && (
          <div className="space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-surface border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-secondary">{validation.totalRows}</p>
                <p className="text-xs text-muted mt-1">Total Rows</p>
              </div>
              <div className={`border rounded-xl p-4 text-center ${validation.validRows > 0 ? 'bg-green-50 border-green-200' : 'bg-surface border-border'}`}>
                <p className="text-2xl font-bold text-green-700">{validation.validRows}</p>
                <p className="text-xs text-muted mt-1">Valid</p>
              </div>
              <div className={`border rounded-xl p-4 text-center ${validation.invalidRows > 0 ? 'bg-red-50 border-red-200' : 'bg-surface border-border'}`}>
                <p className="text-2xl font-bold text-red-700">{validation.invalidRows}</p>
                <p className="text-xs text-muted mt-1">Errors</p>
              </div>
            </div>

            {/* Errors table */}
            {validation.errors.length > 0 && (
              <div className="border border-red-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border-b border-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700">{validation.errors.length} validation error{validation.errors.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-background">
                        <th className="text-left px-4 py-2 font-semibold text-muted w-16">Row</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted w-32">Column</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.errors.map((err, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-red-50/50">
                          <td className="px-4 py-2 font-mono text-muted">{err.row}</td>
                          <td className="px-4 py-2 font-mono text-secondary">{err.column}</td>
                          <td className="px-4 py-2 text-red-700">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Preview table */}
            {validation.preview.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-secondary">
                    Preview — {validation.validRows > 20 ? `first 20 of ${validation.validRows}` : `${validation.validRows}`} valid rows
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-background">
                        <th className="text-left px-3 py-2 font-semibold text-muted w-12">Row</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted">Name</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted w-24">Status</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted w-28">Category</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted w-20">Price</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.preview.map((row) => (
                        <tr key={row.row} className="border-b border-border last:border-0 hover:bg-surface">
                          <td className="px-3 py-2 font-mono text-muted">{row.row}</td>
                          <td className="px-3 py-2 font-semibold text-secondary">{row.name}</td>
                          <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                          <td className="px-3 py-2 font-mono text-muted">{row.categorySlug}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-secondary">${row.basePrice.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {row.tags.slice(0, 3).map((t) => (
                                <span key={t} className="px-1.5 py-0.5 bg-muted/10 rounded text-muted">{t}</span>
                              ))}
                              {row.tags.length > 3 && (
                                <span className="px-1.5 py-0.5 bg-muted/10 rounded text-muted">+{row.tags.length - 3}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {validation.errors.length > 0 && validation.validRows === 0 && (
              <p className="text-sm text-muted text-center py-2">Fix all errors before importing.</p>
            )}
          </div>
        )}

        {/* ── Import result ─────────────────────────────────────────────────── */}
        {result && stage === 'done' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                <p className="text-xs text-muted mt-1">Imported</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-muted mt-1">Updated</p>
              </div>
              <div className={`border rounded-xl p-4 text-center ${result.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-surface border-border'}`}>
                <p className={`text-2xl font-bold ${result.failed > 0 ? 'text-red-700' : 'text-secondary'}`}>{result.failed}</p>
                <p className="text-xs text-muted mt-1">Failed</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border border-red-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border-b border-red-200">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700">{result.errors.length} row{result.errors.length !== 1 ? 's' : ''} failed</span>
                </div>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-background">
                        <th className="text-left px-4 py-2 font-semibold text-muted w-16">Row</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 font-mono text-muted">{err.row}</td>
                          <td className="px-4 py-2 text-red-700">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Link
                href="/products"
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-button transition-colors"
              >
                View Products
              </Link>
              <button
                type="button"
                onClick={reset}
                className="text-sm text-muted hover:text-secondary transition-colors"
              >
                Import another file
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
