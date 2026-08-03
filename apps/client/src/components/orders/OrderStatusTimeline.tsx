import React from 'react';
import { Check } from 'lucide-react';
import type { OrderStatus, OrderStatusHistoryDto } from '@ezihubb/types';

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'CONFIRMED',     label: 'Confirmed'     },
  { status: 'IN_PRODUCTION', label: 'In Production' },
  { status: 'SHIPPED',       label: 'Shipped'       },
  { status: 'DELIVERED',     label: 'Delivered'     },
  { status: 'COMPLETED',     label: 'Completed'     },
];

const STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  CONFIRMED:     0,
  IN_PRODUCTION: 1,
  SHIPPED:       2,
  DELIVERED:     3,
  COMPLETED:     4,
};

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day:   'numeric',
  year:  'numeric',
  hour:  'numeric',
  minute: '2-digit',
});

function stepDate(
  status: OrderStatus,
  history: OrderStatusHistoryDto[],
): string | null {
  const entry = history.find((h) => h.status === status);
  if (!entry) return null;
  return dateFmt.format(new Date(entry.createdAt));
}

// ── Step state helpers ────────────────────────────────────────────────────────

type StepState = 'completed' | 'current' | 'upcoming';

function getStepState(stepRank: number, currentRank: number): StepState {
  if (stepRank < currentRank)  return 'completed';
  if (stepRank === currentRank) return 'current';
  return 'upcoming';
}

// ── Vertical timeline ─────────────────────────────────────────────────────────

function VerticalTimeline({
  steps,
  currentRank,
  history,
}: {
  steps: typeof STEPS;
  currentRank: number;
  history: OrderStatusHistoryDto[];
}) {
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, i) => {
        const rank  = STATUS_RANK[step.status] ?? i;
        const state = getStepState(rank, currentRank);
        const date  = state !== 'upcoming' ? stepDate(step.status, history) : null;
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
                  state === 'upcoming' ? 'text-muted' : 'text-secondary',
                ].join(' ')}
              >
                {step.label}
              </p>
              {date && (
                <p className="text-xs text-muted mt-0.5">{date}</p>
              )}
              {state === 'current' && !date && (
                <p className="text-xs text-primary mt-0.5">In progress</p>
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
  history,
}: {
  steps: typeof STEPS;
  currentRank: number;
  history: OrderStatusHistoryDto[];
}) {
  return (
    <ol className="flex items-start gap-0 w-full">
      {steps.map((step, i) => {
        const rank   = STATUS_RANK[step.status] ?? i;
        const state  = getStepState(rank, currentRank);
        const date   = state !== 'upcoming' ? stepDate(step.status, history) : null;
        const isLast = i === steps.length - 1;

        return (
          <li key={step.status} className="flex flex-1 flex-col items-center">
            {/* Row: connector-left + circle + connector-right */}
            <div className="flex items-center w-full">
              <div
                className={[
                  'flex-1 h-0.5',
                  i === 0 ? 'invisible' : '',
                  rank <= currentRank ? 'bg-primary' : 'bg-border',
                ].join(' ')}
              />
              <StepCircle state={state} />
              <div
                className={[
                  'flex-1 h-0.5',
                  isLast ? 'invisible' : '',
                  rank < currentRank ? 'bg-primary' : 'bg-border',
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
                    : state === 'upcoming'
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
  const currentRank = STATUS_RANK[currentStatus] ?? -1;

  if (orientation === 'horizontal') {
    return (
      <HorizontalTimeline steps={STEPS} currentRank={currentRank} history={history} />
    );
  }

  return (
    <VerticalTimeline steps={STEPS} currentRank={currentRank} history={history} />
  );
}
