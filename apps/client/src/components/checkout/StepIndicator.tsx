import { Check, ShoppingCart } from 'lucide-react';

interface StepIndicatorProps {
  currentStep:    1 | 2 | 3;
  completedSteps: number[];
}

const STEPS = [
  { id: 1, label: 'Shipping' },
  { id: 2, label: 'Delivery' },
  { id: 3, label: 'Payment' },
] as const;

export function StepIndicator({ currentStep, completedSteps }: StepIndicatorProps) {
  return (
    <nav aria-label="Checkout steps" className="flex items-center gap-0 w-full mb-8">
      {/* Cart — always completed */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        </span>
        <span className="hidden sm:block text-xs font-medium text-primary">Cart</span>
      </div>

      {STEPS.map((step, i) => {
        const isDone    = completedSteps.includes(step.id);
        const isActive  = currentStep === step.id;
        const isUpcoming = !isDone && !isActive;

        return (
          <div key={step.id} className="flex items-center flex-1">
            {/* Connector line */}
            <div
              className={[
                'flex-1 h-0.5 mx-1',
                isDone || isActive ? 'bg-primary' : 'bg-border',
              ].join(' ')}
              aria-hidden="true"
            />

            {/* Step node + label */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                aria-current={isActive ? 'step' : undefined}
                className={[
                  'w-7 h-7 rounded-full flex items-center justify-center transition-all',
                  isDone   ? 'bg-primary'                                : '',
                  isActive ? 'border-2 border-primary bg-primary/10'     : '',
                  isUpcoming ? 'border-2 border-border bg-background'    : '',
                ].join(' ')}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                ) : (
                  <span
                    className={[
                      'text-xs font-bold',
                      isActive   ? 'text-primary'  : '',
                      isUpcoming ? 'text-muted'    : '',
                    ].join(' ')}
                  >
                    {step.id}
                  </span>
                )}
              </div>
              <span
                className={[
                  'hidden sm:block text-xs font-medium',
                  isDone || isActive ? 'text-secondary' : 'text-muted',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
