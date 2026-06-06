import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { FAQ_DATA } from '../../../../../components/faq/faq-data';
import { FAQAccordionList } from '../../../../../components/faq/FAQAccordionList';
import { FAQSearchBar } from '../../../../../components/faq/FAQSearchBar';
import { FAQStructuredData } from '../../../../../components/seo/FAQStructuredData';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'FAQ | MapleLoomHandmade',
    description:
      'Frequently asked questions about ordering, personalization, shipping, and returns at MapleLoomHandmade.',
    robots: { index: true, follow: true },
  };
}

export default function FAQPage() {
  const allFaqs = FAQ_DATA.flatMap((section) => section.questions);
  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">
      <FAQStructuredData faqs={allFaqs} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-12">
        <p className="text-primary font-medium text-sm mb-3 uppercase tracking-wide">FAQ</p>
        <h1 className="font-display text-4xl font-bold text-secondary mb-3">
          Frequently Asked Questions
        </h1>
        <p className="text-muted text-lg max-w-xl mx-auto">
          Everything you need to know about ordering, personalization, and delivery.
        </p>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <FAQSearchBar />

      {/* ── FAQ sections ──────────────────────────────────────────────────── */}
      <div className="space-y-12 mt-10">
        {FAQ_DATA.map(({ category, Icon, questions }) => (
          <div key={category}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-secondary">{category}</h2>
            </div>
            <FAQAccordionList questions={questions} />
          </div>
        ))}
      </div>

      {/* ── Still need help ───────────────────────────────────────────────── */}
      <div className="mt-16 text-center bg-[#FAFAF8] rounded-3xl p-10">
        <h2 className="text-xl font-bold text-secondary mb-2">Still have questions?</h2>
        <p className="text-muted mb-6">
          Our support team responds within 2 hours on business days.
        </p>
        <Link
          href="/pages/contact"
          className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-full font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Contact Support
        </Link>
      </div>
    </div>
  );
}
