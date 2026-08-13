'use client';

import { useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { COUNTRIES } from '../../shipping/delivery/countries';

interface PreviewMethod {
  destinationType: string;
  chargeType:      'FIXED' | 'FREE';
  price?:          number | null;
}

interface Props {
  originCountry: string | null;
  methods:       PreviewMethod[] | undefined;
}

function destinationLabel(destinationType: string, originCountry: string | null): string {
  if (destinationType === 'domestic') return COUNTRIES.find((c) => c.code === originCountry)?.name ?? originCountry ?? 'Domestic';
  if (destinationType === 'everywhere_else') return 'Everywhere else';
  return COUNTRIES.find((c) => c.code === destinationType)?.name ?? destinationType;
}

// Reads straight off the already-fetched profile's own methods — no separate
// API round trip. Previously called a `/admin/shipping-profiles/:id/preview`
// route that was never actually implemented on the backend, so this panel
// showed "Loading preview..." forever.
export function ShippingCostPreview({ originCountry, methods }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!methods?.length) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors"
      >
        <Lightbulb className="w-3.5 h-3.5 text-primary" />
        <span>Preview shipping cost</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-3 bg-[#F9FAFB] rounded-xl p-4 text-sm space-y-2">
          {methods.map((m) => (
            <div key={m.destinationType} className="flex justify-between">
              <span className="text-muted">{destinationLabel(m.destinationType, originCountry)}</span>
              <span className="font-medium text-secondary tabular-nums">
                {m.chargeType === 'FREE' ? 'Free' : `$${Number(m.price ?? 0).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
