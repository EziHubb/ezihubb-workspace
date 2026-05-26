import { Check, ExternalLink } from "lucide-react";

interface TimelineStep {
  status: "completed" | "current" | "upcoming";
  label: string;
  date?: string;
  trackingInfo?: {
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string;
  };
}

interface StatusTimelineProps {
  steps: TimelineStep[];
}

export function StatusTimeline({ steps }: StatusTimelineProps) {
  return (
    <div className="relative pl-8 md:pl-10">
      {/* Vertical Line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[#E8E4DF]" />

      {steps.map((step, index) => (
        <div key={index} className="relative pb-8 last:pb-0">
          {/* Circle */}
          <div
            className={`absolute left-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
              step.status === "completed"
                ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                : step.status === "current"
                ? "bg-[var(--color-primary)] border-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/20 animate-pulse"
                : "bg-white border-[#E8E4DF]"
            }`}
          >
            {step.status === "completed" && (
              <Check className="w-4 h-4 text-white stroke-[3]" />
            )}
            {step.status === "current" && (
              <div className="w-3 h-3 bg-white rounded-full" />
            )}
          </div>

          {/* Content */}
          <div className="ml-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-4">
              <h5
                className={`font-semibold text-base ${
                  step.status === "current"
                    ? "text-[var(--color-primary)]"
                    : step.status === "completed"
                    ? "text-[var(--color-secondary)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {step.label}
              </h5>
              {step.date && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  {step.date}
                </p>
              )}
            </div>

            {/* Tracking Info (only for current shipping step) */}
            {step.trackingInfo && step.status === "current" && (
              <div className="mt-2 p-3 bg-[var(--color-background)] rounded-lg">
                <p className="text-sm text-[var(--color-text-muted)] mb-1">
                  {step.trackingInfo.carrier} · Tracking #{" "}
                  {step.trackingInfo.trackingNumber}
                </p>
                {step.trackingInfo.trackingUrl && (
                  <a
                    href={step.trackingInfo.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline font-medium"
                  >
                    Track with {step.trackingInfo.carrier}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
