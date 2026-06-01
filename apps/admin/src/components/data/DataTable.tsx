'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminTableRowSkeleton } from '../skeletons/AdminTableRowSkeleton';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DataTablePagination {
  page:         number;
  limit:        number;
  total:        number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  data:         T[];
  columns:      ColumnDef<T>[];
  isLoading?:   boolean;
  pagination?:  DataTablePagination;
  onRowClick?:  (row: T) => void;
  selectable?:  boolean;
  bulkActions?: React.ReactNode;
  emptyTitle?:  string;
  emptyDesc?:   string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DataTable<T>({
  data,
  columns,
  isLoading    = false,
  pagination,
  onRowClick,
  selectable   = false,
  bulkActions,
  emptyTitle   = 'No data',
  emptyDesc    = 'Nothing to show here yet.',
}: DataTableProps<T>) {
  const [sorting,      setSorting]      = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Prepend checkbox column when selectable
  const allColumns = useMemo<ColumnDef<T>[]>(() => {
    if (!selectable) return columns;
    return [
      {
        id:     'select',
        size:   40,
        header: ({ table }) => (
          <input
            type="checkbox"
            className="w-4 h-4 accent-primary rounded"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="w-4 h-4 accent-primary rounded"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      ...columns,
    ];
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns:              allColumns,
    state:                { sorting, rowSelection },
    onSortingChange:      setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel:      getCoreRowModel(),
    getSortedRowModel:    getSortedRowModel(),
    manualPagination:     true,
    enableRowSelection:   selectable,
  });

  const selectedCount  = Object.keys(rowSelection).length;
  const totalPages     = pagination ? Math.ceil(pagination.total / pagination.limit) : 1;
  const showingFrom    = pagination ? (pagination.page - 1) * pagination.limit + 1 : 1;
  const showingTo      = pagination
    ? Math.min(pagination.page * pagination.limit, pagination.total)
    : data.length;

  return (
    <div className="relative">
      {/* ── Bulk action bar ─────────────────────────────────────────────────── */}
      {selectable && selectedCount > 0 && bulkActions && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-button animate-fadeIn">
          <span className="text-sm font-medium text-primary">
            {selectedCount} selected
          </span>
          <div className="flex gap-2 ml-auto">{bulkActions}</div>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-card border border-border overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border bg-background">
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted  = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                        className={[
                          'px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap',
                          canSort ? 'cursor-pointer select-none hover:text-secondary' : '',
                        ].join(' ')}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        <span className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            sorted === 'asc'  ? <ChevronUp   className="w-3 h-3" /> :
                            sorted === 'desc' ? <ChevronDown className="w-3 h-3" /> :
                            <ChevronsUpDown className="w-3 h-3 text-border" />
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <AdminTableRowSkeleton key={i} cols={allColumns.length} />
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={allColumns.length} className="px-4 py-16 text-center">
                    <p className="font-medium text-secondary mb-1">{emptyTitle}</p>
                    <p className="text-sm text-muted">{emptyDesc}</p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={[
                      'transition-colors',
                      onRowClick ? 'cursor-pointer hover:bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]',
                      row.getIsSelected() ? 'bg-primary/3' : '',
                    ].join(' ')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-secondary">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted">
              Showing <span className="font-medium text-secondary">{showingFrom}–{showingTo}</span> of{' '}
              <span className="font-medium text-secondary">{pagination.total}</span>
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded hover:bg-muted/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => pagination.onPageChange(p)}
                    className={[
                      'w-8 h-8 rounded text-xs font-medium transition-colors',
                      p === pagination.page
                        ? 'bg-primary text-white'
                        : 'hover:bg-muted/10 text-secondary',
                    ].join(' ')}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= totalPages}
                className="p-1.5 rounded hover:bg-muted/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
