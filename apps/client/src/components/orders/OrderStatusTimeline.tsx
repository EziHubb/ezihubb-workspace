import React, { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import type { OrderStatus, OrderStatusHistoryDto } from '@ezihubb/types';

// ── Step definitions ──────────────────────────────────────────────────────────

function useSteps(): { status: OrderStatus; label: string }[] {
  const t = useTranslations('orderTracking.timeline');
  return [
    { status: 'CONFIRMED',     label: t('confirmed')     },
    { status: 'IN_PRODUCTION', label: t('inProduction')  },
    { status: 'SHIPPED',       label: t('shipped')       },
    { status: 'DELIVERED',     label: t('delivered')     },
    { status: 'COMPLETED',     label: t('completed')     },
  ];
}

type Steps = ReturnType<typeof useSteps>;

const STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  CONFIRMED:     0,
  IN_PRODUCTION: 1,
  SHIPPED:       2,
  DELIVERED:     3,
  COMPLETED:     4,
};

function stepDate(
  status: OrderStatus,
  history: OrderStatusHistoryDto[],
  locale: string,
): string | null {
  const entry = history.find((h) => h.status === status);
  if (!entry) return null;
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
    hour:  'numeric',
    minute: '2-digit',
  });
  return dateFmt.format(new Date(entry.createdAt));
}

// ── Step state helpers ────────────────────────────────────────────────────────

type StepState = 'completed' | 'current' | 'upcoming' | 'skipped';

/**
 * A tick has to be earned by the history, not inferred from the position.
 *
 * This used to answer "completed" for every step ranked below the current
 * one, which meant an order moved straight to COMPLETED drew green ticks on
 * In Production, Shipped and Delivered — three things that never happened.
 * The dates below come from the real history, so those steps showed a tick
 * with no date under it, which is exactly what gave it away.
 *
 * Nothing forces a shop through every step; a shop's pipeline is its own, and
 * a short one is legitimate. What is not legitimate is telling the buyer their
 * parcel shipped because the order finished.
 *
 * 'skipped' is a past step with nothing recorded for it. It is drawn plainly
 * rather than as a failure — the order did reach the end, this stage simply
 * has nothing to report.
 */
function getStepState(
  stepStatus: OrderStatus,
  stepRank: number,
  currentRank: number,
  reached: Set<OrderStatus>,
): StepState {
  if (stepRank === currentRank) return 'current';
  if (stepRank > currentRank)   return 'upcoming';
  return reached.has(stepStatus) ? 'completed' : 'skipped';
}

// ── Vertical timeline ─────────────────────────────────────────────────────────

function VerticalTimeline({
  steps,
  currentRank,
  reached,
  history,
  locale,
}: {
  steps: Steps;
  currentRank: number;
  reached: Set<OrderStatus>;
  history: OrderStatusHistoryDto[];
  locale: string;
}) {
  const t = useTranslations('orderTracking.timeline');
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, i) => {
        const rank  = STATUS_RANK[step.status] ?? i;
        const state = getStepState(step.status, rank, currentRank, reached);
        const date  = state === 'completed' || state === 'current'
          ? stepDate(step.status, history, locale)
          : null;
        const isLast = i === steps.length - 1;

        return (
          <li key={step.status} className="flex gap-4">
            {/* Left: circle + connector */}
            <div className="flex flex-col items-center">
              <StepCircle state={state} />
              {!isLast && (
                <div
                  className={[
                    'w-0.5 flex-1 my-1',
                    state === 'completed' ? 'bg-primary' : 'bg-border',
                  ].join(' ')}
                />
              )}
            </div>

            {/* Right: label + date */}
            <div className={['pb-8', isLast ? 'pb-0' : ''].join(' ')}>
              <p
                className={[
                  'text-sm font-semibold leading-8',
                  state === 'upcoming' || state === 'skipped' ? 'text-muted' : 'text-secondary',
                ].join(' ')}
              >
                {step.label}
              </p>
              {date && (
                <p className="text-xs text-muted mt-0.5">{date}</p>
              )}
              {state === 'current' && !date && (
                <p className="text-xs text-primary mt-0.5">{t('inProgress')}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Horizontal timeline ───────────────────────────────────────────────────────

function HorizontalTimeline({
  steps,
  currentRank,
  reached,
  history,
  locale,
}: {
  steps: Steps;
  currentRank: number;
  reached: Set<OrderStatus>;
  history: OrderStatusHistoryDto[];
  locale: string;
}) {
  return (
    <ol className="flex items-start gap-0 w-full">
      {steps.map((step, i) => {
        const rank   = STATUS_RANK[step.status] ?? i;
        const state  = getStepState(step.status, rank, currentRank, reached);
        const date   = state === 'completed' || state === 'current'
          ? stepDate(step.status, history, locale)
          : null;
        const isLast = i === steps.length - 1;

        return (
          <li key={step.status} className="flex flex-1 flex-col items-center">
            {/* Row: connector-left + circle + connector-right */}
            <div className="flex items-center w-full">
              <div
                className={[
                  'flex-1 h-0.5',
                  i === 0 ? 'invisible' : '',
                  state === 'completed' || state === 'current' ? 'bg-primary' : 'bg-border',
                ].join(' ')}
              />
              <StepCircle state={state} />
              <div
                className={[
                  'flex-1 h-0.5',
                  isLast ? 'invisible' : '',
                  state === 'completed' ? 'bg-primary' : 'bg-border',
                ].join(' ')}
              />
            </div>

            {/* Label + date below */}
            <div className="mt-2 text-center px-1">
              <p
                className={[
                  'text-xs font-semibold',
                  state === 'current'
                    ? 'text-primary'
                    : state === 'upcoming' || state === 'skipped'
                      ? 'text-muted'
                      : 'text-secondary',
                ].join(' ')}
              >
                {step.label}
              </p>
              {date && (
                <p className="text-[10px] text-muted mt-0.5 leading-tight">{date}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Step circle ───────────────────────────────────────────────────────────────

function StepCircle({ state }: { state: StepState }) {
  if (state === 'completed') {
    return (
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
        <Check className="w-4 h-4 text-white" strokeWidth={3} />
      </div>
    );
  }

  if (state === 'current') {
    return (
      <div className="relative w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
        <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }

  // A dash, not a dot: it sits BEFORE the current step, where a reader expects
  // something to have happened, so it has to say "nothing recorded here"
  // rather than look like a stage still to come.
  if (state === 'skipped') {
    return (
      <div className="w-8 h-8 rounded-full border-2 border-border flex items-center justify-center shrink-0">
        <div className="w-2.5 h-0.5 rounded-full bg-border" />
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-full border-2 border-border flex items-center justify-center shrink-0">
      <div className="w-2 h-2 rounded-full bg-border" />
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface OrderStatusTimelineProps {
  currentStatus: OrderStatus;
  history?:      OrderStatusHistoryDto[];
  orientation?:  'horizontal' | 'vertical';
}

export function OrderStatusTimeline({
  currentStatus,
  history      = [],
  orientation  = 'vertical',
}: OrderStatusTimelineProps) {
  const locale = useLocale();
  const steps  = useSteps();
  const currentRank = STATUS_RANK[currentStatus] ?? -1;
  // What actually happened, straight from the status history. A Set because
  // both orientations ask about every step and the list is tiny.
  const reached = useMemo(
    () => new Set(history.map((h) => h.status)),
    [history],
  );

  if (orientation === 'horizontal') {
    return (
      <HorizontalTimeline steps={steps} currentRank={currentRank} reached={reached} history={history} locale={locale} />
    );
  }

  return (
    <VerticalTimeline steps={steps} currentRank={currentRank} reached={reached} history={history} locale={locale} />
  );
}
