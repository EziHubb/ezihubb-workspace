'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { clientFetch } from '../../../lib/api';
import { fetchArr } from '../../../lib/fmt';

interface ShippingDestination {
  label: string;
  price: string;
}

interface Props { profileId: string | null }

export function ShippingCostPreview({ profileId }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const { data: destinations = [] } = useQuery<ShippingDestination[]>({
    queryKey: ['shipping-preview', profileId],
    queryFn: () => clientFetch(`/admin/shipping-profiles/${profileId}/preview`)
      .then(fetchArr<ShippingDestination>),
    enabled: !!profileId && isOpen,
  })

  if (!profileId) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors"
      >
        <i className="ti ti-bulb text-primary" />
        <span>Preview shipping cost</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-3 bg-[#F9FAFB] rounded-xl p-4 text-sm space-y-2">
          {destinations.length > 0 ? destinations.map(d => (
            <div key={d.label} className="flex justify-between">
              <span className="text-muted">{d.label}</span>
              <span className="font-medium text-secondary">{d.price}</span>
            </div>
          )) : (
            <p className="text-muted text-xs">Loading preview...</p>
          )}
        </div>
      )}
    </div>
  )
}
