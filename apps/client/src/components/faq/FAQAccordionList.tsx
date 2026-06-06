'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FaqQuestion } from './faq-data';

function FAQItem({ faq }: { faq: FaqQuestion }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#FAFAF8] transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-secondary text-sm pr-4">{faq.q}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-sm text-muted leading-relaxed">
          {faq.a}
        </div>
      )}
    </div>
  );
}

export function FAQAccordionList({ questions }: { questions: FaqQuestion[] }) {
  return (
    <div className="divide-y border border-border rounded-2xl overflow-hidden">
      {questions.map((faq) => (
        <FAQItem key={faq.q} faq={faq} />
      ))}
    </div>
  );
}
