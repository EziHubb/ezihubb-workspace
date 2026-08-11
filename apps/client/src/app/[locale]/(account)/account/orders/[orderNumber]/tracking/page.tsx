'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Truck,
  Package,
} from 'lucide-react';
import { Skeleton } from '@ezihubb/ui';
import { useAuthQuery } from '../../../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@ezihubb/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

type TrackingStage =
  | 'ORDER_CONFIRMED'
  | 'PAYMENT_VERIFIED'
  | 'IN_PRODUCTION'
  | 'PRODUCTION_COMPLETE'
  | 'SHIPPED'
  | 'SENT_TO_FULFILLMENT'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED_DELIVERY';

interface TrackingEvent {
  stage:       TrackingStage;
  occurredAt:  string | null;
  description: string | null;
}

interface TrackingDetail {
  orderId:        string;
  currentStage:   TrackingStage | null;
  carrier:        string | null;
  trackingNumber: string | null;
  trackingUrl:    string | null;
  events:         TrackingEvent[];
  hasFailed:      boolean;
}

// ── Stage config ──────────────────────────────────────────────────────────────

const MAIN_STAGES: TrackingStage[] = [
  'ORDER_CONFIRMED',
  'PAYMENT_VERIFIED',
  'IN_PRODUCTION',
  'PRODUCTION_COMPLETE',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

function useStageLabels(t: ReturnType<typeof useTranslations>): Record<TrackingStage, string> {
  return {
    ORDER_CONFIRMED:     t('stages.ORDER_CONFIRMED.label'),
    PAYMENT_VERIFIED:    t('stages.PAYMENT_VERIFIED.label'),
    IN_PRODUCTION:       t('stages.IN_PRODUCTION.label'),
    PRODUCTION_COMPLETE: t('stages.PRODUCTION_COMPLETE.label'),
    SHIPPED:             t('stages.SHIPPED.label'),
    SENT_TO_FULFILLMENT: t('stages.SENT_TO_FULFILLMENT.label'),
    IN_TRANSIT:          t('stages.IN_TRANSIT.label'),
    OUT_FOR_DELIVERY:    t('stages.OUT_FOR_DELIVERY.label'),
    DELIVERED:           t('stages.DELIVERED.label'),
    FAILED_DELIVERY:     t('stages.FAILED_DELIVERY.label'),
  };
}

function useStageDescriptions(t: ReturnType<typeof useTranslations>): Record<TrackingStage, string> {
  return {
    ORDER_CONFIRMED:     t('stages.ORDER_CONFIRMED.description'),
    PAYMENT_VERIFIED:    t('stages.PAYMENT_VERIFIED.description'),
    IN_PRODUCTION:       t('stages.IN_PRODUCTION.description'),
    PRODUCTION_COMPLETE: t('stages.PRODUCTION_COMPLETE.description'),
    SHIPPED:             t('stages.SHIPPED.description'),
    SENT_TO_FULFILLMENT: t('stages.SENT_TO_FULFILLMENT.description'),
    IN_TRANSIT:          t('stages.IN_TRANSIT.description'),
    OUT_FOR_DELIVERY:    t('stages.OUT_FOR_DELIVERY.description'),
    DELIVERED:           t('stages.DELIVERED.description'),
    FAILED_DELIVERY:     t('stages.FAILED_DELIVERY.description'),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stageIndex(stage: TrackingStage | null, stages: TrackingStage[]) {
  if (!stage) return -1;
  return stages.indexOf(stage);
}

// ── Stage circle ──────────────────────────────────────────────────────────────

function StageCircle({ status }: { status: 'done' | 'current' | 'pending' | 'failed' }) {
  if (status === 'done') {
    return <CheckCircle2 className="w-7 h-7 text-primary shrink-0" />;
  }
  if (status === 'current') {
    return (
      <div className="w-7 h-7 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center shrink-0">
        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
      </div>
    );
  }
  if (status === 'failed') {
    return <XCircle className="w-7 h-7 text-error shrink-0" />;
  }
  return <Circle className="w-7 h-7 text-border shrink-0" />;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TrackingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton variant="text" className="w-48 h-7" />
      <div className="space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-4">
            <Skeleton variant="rect" className="w-7 h-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <Skeleton variant="text" className="w-40" />
              <Skeleton variant="text" className="w-64" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrderTrackingPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const locale          = useLocale();
  const t               = useTranslations('orderTracking.detailedTracking');
  const stageLabels       = useStageLabels(t);
  const stageDescriptions = useStageDescriptions(t);

  const fmtDate = new Intl.DateTimeFormat(locale, {
    month:   'short',
    day:     'numeric',
    year:    'numeric',
    hour:    'numeric',
    minute:  '2-digit',
  });

  const { data: tracking, isLoading, isError } = useAuthQuery<TrackingDetail>(
    ['order-tracking', orderNumber],
    API_ROUTES.ORDER_TRACKING.DETAIL(orderNumber),
    undefined,
    { enabled: !!orderNumber },
  );

  const eventMap: Partial<Record<TrackingStage, TrackingEvent>> = {};
  (tracking?.events ?? []).forEach((ev) => {
    eventMap[ev.stage] = ev;
  });

  const currentIdx = stageIndex(tracking?.currentStage ?? null, MAIN_STAGES);

  const stagesToRender: TrackingStage[] = [
    ...MAIN_STAGES,
    ...(tracking?.hasFailed ? (['FAILED_DELIVERY'] as TrackingStage[]) : []),
  ];

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/account/orders`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('backToOrders')}
      </Link>

      <h1 className="font-display text-2xl font-bold text-secondary">{t('pageTitle')}</h1>

      {isLoading && <TrackingSkeleton />}

      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Package className="w-12 h-12 text-muted/30" />
          <p className="text-sm text-muted">{t('notAvailable')}</p>
          <Link
            href={`/${locale}/account/orders`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('goBackToOrders')}
          </Link>
        </div>
      )}

      {tracking && !isLoading && (
        <>
          {(tracking.carrier || tracking.trackingNumber) && (
            <div className="flex items-center gap-3 p-4 bg-surface border border-border rounded-card">
              <Truck className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                {tracking.carrier && (
                  <p className="text-sm font-semibold text-secondary">{tracking.carrier}</p>
                )}
                {tracking.trackingNumber && (
                  <p className="font-mono text-xs text-muted">{tracking.trackingNumber}</p>
                )}
              </div>
              {tracking.trackingUrl && (
                <a
                  href={tracking.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary hover:underline shrink-0"
                >
                  {t('trackOnCarrierSite')}
                </a>
              )}
            </div>
          )}

          <div role="list" aria-label={t('ariaLabel')} className="relative">
            {stagesToRender.map((stage, i) => {
              const idx       = MAIN_STAGES.indexOf(stage);
              const isFailed  = stage === 'FAILED_DELIVERY';
              const isDone    = !isFailed && idx !== -1 && idx < currentIdx;
              const isCurrent = !isFailed && idx === currentIdx;
              const isPending = !isFailed && idx > currentIdx;

              let circleStatus: 'done' | 'current' | 'pending' | 'failed' = 'pending';
              if (isFailed)       circleStatus = 'failed';
              else if (isDone)    circleStatus = 'done';
              else if (isCurrent) circleStatus = 'current';

              const event     = eventMap[stage];
              const timestamp = event?.occurredAt
                ? fmtDate.format(new Date(event.occurredAt))
                : null;
              const isLast    = i === stagesToRender.length - 1;

              return (
                <div key={stage} role="listitem" className="flex gap-4 relative">
                  <div className="flex flex-col items-center">
                    <StageCircle status={circleStatus} />
                    {!isLast && (
                      <div
                        className={[
                          'w-0.5 flex-1 my-1 min-h-[32px]',
                          isDone ? 'bg-primary' : 'bg-border',
                        ].join(' ')}
                      />
                    )}
                  </div>

                  <div className={['pb-6 pt-0.5 flex-1', isLast ? 'pb-0' : ''].join(' ')}>
                    <p
                      className={[
                        'text-sm font-semibold',
                        isCurrent ? 'text-primary' :
                        isFailed  ? 'text-error'   :
                        isDone    ? 'text-secondary' : 'text-muted',
                      ].join(' ')}
                    >
                      {stageLabels[stage]}
                    </p>

                    {(isCurrent || isDone || isFailed) && (
                      <p className="text-xs text-muted mt-0.5">
                        {event?.description ?? stageDescriptions[stage]}
                      </p>
                    )}

                    {isPending && !isFailed && (
                      <p className="text-xs text-muted/60 mt-0.5">
                        {stageDescriptions[stage]}
                      </p>
                    )}

                    {timestamp && (
                      <p className="text-xs text-muted mt-1 tabular-nums">{timestamp}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
