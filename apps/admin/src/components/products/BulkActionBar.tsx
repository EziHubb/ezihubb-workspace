'use client';

import { Eye, EyeOff, Archive, Tag, Download, Loader2 } from 'lucide-react';

interface BulkActionBarProps {
  count:       number;
  isLoading:   boolean;
  onPublish:   () => void;
  onUnpublish: () => void;
  onArchive:   () => void;
  onSetSale:   () => void;
  onExport:    () => void;
}

export function BulkActionBar({
  count,
  isLoading,
  onPublish,
  onUnpublish,
  onArchive,
  onSetSale,
  onExport,
}: BulkActionBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-4 py-2.5 bg-secondary text-white rounded-2xl shadow-2xl">
      <span className="text-sm font-semibold mr-2 pr-2 border-r border-white/20">
        {count} selected
      </span>

      <button
        type="button"
        onClick={onPublish}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-white/10 disabled:opacity-50 transition-colors"
      >
        <Eye className="w-3.5 h-3.5" />
        Publish
      </button>

      <button
        type="button"
        onClick={onUnpublish}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-white/10 disabled:opacity-50 transition-colors"
      >
        <EyeOff className="w-3.5 h-3.5" />
        Unpublish
      </button>

      <button
        type="button"
        onClick={onSetSale}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-white/10 disabled:opacity-50 transition-colors"
      >
        <Tag className="w-3.5 h-3.5" />
        Set sale
      </button>

      <button
        type="button"
        onClick={onExport}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-white/10 disabled:opacity-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>

      <div className="w-px h-5 bg-white/20 mx-1" />

      <button
        type="button"
        onClick={onArchive}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-300 hover:bg-white/10 disabled:opacity-50 transition-colors"
      >
        <Archive className="w-3.5 h-3.5" />
        Archive
      </button>

      {isLoading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
    </div>
  );
}
