'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ShowMoreAttributesProps {
  children:       React.ReactNode;
  defaultOpen?:   boolean;
  collapsedLabel?: string;
  expandedLabel?:  string;
}

export function ShowMoreAttributes({
  children,
  defaultOpen    = false,
  collapsedLabel = 'Show more attributes',
  expandedLabel  = 'Show less',
}: ShowMoreAttributesProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      {/* Collapsible content — CSS transition for smooth open/close */}
      <div
        className={[
          'overflow-hidden transition-all duration-300',
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
        aria-hidden={!isOpen}
      >
        <div className="space-y-6 pt-6">{children}</div>
      </div>

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mt-4 w-full py-2.5 text-sm font-medium text-secondary bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-xl transition-colors flex items-center justify-center gap-1.5"
      >
        {isOpen
          ? <><ChevronUp   className="w-4 h-4" />{expandedLabel}</>
          : <><ChevronDown className="w-4 h-4" />{collapsedLabel}</>}
      </button>
    </div>
  );
}
