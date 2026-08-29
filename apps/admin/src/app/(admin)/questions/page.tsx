'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MessageCircle, Search } from 'lucide-react';
import { API_ROUTES } from '@ezihubb/constants';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import {
  QuestionRow,
  type Question,
} from '../../../components/products/edit/tabs/QaTab';
import { api } from '../../../lib/api-client';

type Filter = 'all' | 'unanswered' | 'answered';

interface QuestionPage {
  data: Question[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const PAGE_SIZE = 24;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unanswered', label: 'Unanswered' },
  { value: 'answered', label: 'Answered' },
];

export default function QuestionsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('unanswered');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [filter]);

  const listQuery = useQuery<QuestionPage>({
    queryKey: ['admin-questions', filter, debouncedSearch, page],
    queryFn: () =>
      api.get<QuestionPage>(API_ROUTES.ADMIN.QUESTIONS, {
        params: {
          filter,
          page,
          limit: PAGE_SIZE,
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
        },
      }),
  });

  const unansweredQuery = useQuery<{ count: number }>({
    queryKey: ['sidebar-questions-unanswered'],
    queryFn: () =>
      api.get<{ count: number }>(API_ROUTES.ADMIN.QUESTIONS_UNANSWERED),
    staleTime: 30_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-questions'] });
    qc.invalidateQueries({ queryKey: ['sidebar-questions-unanswered'] });
  };

  const questions = listQuery.data?.data ?? [];
  const pagination = listQuery.data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);

  return (
    <div className="max-w-5xl">
      <AdminPageHeader
        title="Questions"
        subtitle="Answer customer questions and publish useful answers on product pages"
        queryKey={['admin-questions']}
      />

      <div className="border-b border-border mb-5">
        <nav className="flex items-center gap-1 overflow-x-auto">
          {FILTERS.map((item) => {
            const active = filter === item.value;
            const count =
              item.value === 'unanswered'
                ? unansweredQuery.data?.count
                : active
                  ? total
                  : undefined;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={[
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-secondary hover:border-border',
                ].join(' ')}
              >
                {item.label}
                {count !== undefined && (
                  <span
                    className={[
                      'min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center tabular-nums',
                      item.value === 'unanswered' && count > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-muted/10 text-muted',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search question, customer, email or product…"
            className="w-full h-10 pl-9 pr-3 bg-surface border border-border rounded-button text-sm text-secondary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40"
          />
        </div>
        <p className="text-sm text-muted tabular-nums">
          {total} {total === 1 ? 'question' : 'questions'}
        </p>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-xl border border-border bg-muted/10 animate-pulse"
            />
          ))}
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-card border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-semibold text-red-700">
            Could not load customer questions.
          </p>
          <button
            type="button"
            onClick={() => listQuery.refetch()}
            className="mt-3 text-sm font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-card border border-border bg-surface px-5 py-16 text-center text-muted">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-35" />
          <p className="font-semibold text-secondary">
            {debouncedSearch
              ? 'No questions match your search'
              : filter === 'unanswered'
                ? 'No unanswered questions'
                : filter === 'answered'
                  ? 'No answered questions'
                  : 'No customer questions yet'}
          </p>
          <p className="text-sm mt-1">
            New questions submitted from product pages will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((question) => (
            <QuestionRow
              key={question.id}
              q={question}
              productId={question.product?.id ?? question.productId}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <p className="text-sm text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-button border border-border bg-surface text-sm font-medium text-secondary hover:border-primary/40 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-button border border-border bg-surface text-sm font-medium text-secondary hover:border-primary/40 disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
