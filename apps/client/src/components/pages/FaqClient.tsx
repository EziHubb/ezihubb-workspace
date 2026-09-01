'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, MessageCircle, Mail } from 'lucide-react';

// ── FAQ data ──────────────────────────────────────────────────────────────────

interface FaqItem {
  id:       string;
  category: string;
  question: string;
  answer:   string;
}

const FAQ_DATA: FaqItem[] = [
  // ── Personalization ────────────────────────────────────────────────────────
  {
    id: 'p1', category: 'Personalization',
    question: 'Can I see a preview before my order is produced?',
    answer: 'Yes! After completing your customization, click "Generate Preview" to see a high-quality render of your item. Our server composites all your text and images onto the product mockup. You can review and edit before adding to cart.',
  },
  {
    id: 'p2', category: 'Personalization',
    question: 'What image file formats are accepted for uploads?',
    answer: 'We accept JPG, PNG, WebP, and HEIC files up to 10 MB. For best results use a high-resolution image (at least 1000×1000 px). Our tool also includes background removal and AI art-style effects.',
  },
  {
    id: 'p3', category: 'Personalization',
    question: 'Can I choose a font for my text?',
    answer: 'Absolutely. We offer 8 curated fonts: Dancing Script, Playfair Display, Montserrat, Pacifico, Roboto Slab, Great Vibes, Lato, and Cinzel. Select your preferred style directly on the customizer canvas.',
  },
  {
    id: 'p4', category: 'Personalization',
    question: 'How accurate are the colors on my personalized product?',
    answer: 'The preview is a close approximation. Actual colors may vary slightly depending on your screen calibration and the product material. We print using professional dye-sublimation equipment for the most accurate color reproduction possible.',
  },
  {
    id: 'p5', category: 'Personalization',
    question: 'My customization was saved — can I pick up where I left off?',
    answer: 'Yes! If you\'re logged in, we automatically save your last customization for each product. The next time you visit the product page, an "Auto-fill previous customization" prompt will appear.',
  },
  {
    id: 'p6', category: 'Personalization',
    question: 'What happens if my photo upload fails?',
    answer: 'If your photo fails to upload after 3 attempts, you\'ll see an option to "Continue without photo" and email us the image after checkout. Your order will be flagged for manual processing, and our team will reach out within 1 business day.',
  },

  // ── Orders ─────────────────────────────────────────────────────────────────
  {
    id: 'o1', category: 'Orders',
    question: 'How long does production take?',
    answer: 'Most personalized items are produced within 1–3 business days. Rush production (24 hours) is available for an additional fee — select this option at checkout.',
  },
  {
    id: 'o2', category: 'Orders',
    question: 'How do I track my order?',
    answer: 'Once your order ships, you\'ll receive an email with a tracking link. You can also visit Account → My Orders or our Order Tracking page and enter your order number.',
  },
  {
    id: 'o3', category: 'Orders',
    question: 'Can I cancel or change my order after placing it?',
    answer: 'You can cancel or modify your order within 2 hours of placement. After that, production begins and changes are no longer possible. To cancel, visit Account → My Orders and click "Cancel Order" next to your order — if it\'s within the window.',
  },
  {
    id: 'o4', category: 'Orders',
    question: 'Do you offer gift wrapping?',
    answer: 'Yes! Select "Add gift wrapping" at checkout for $4.99. We\'ll include tissue paper and a personalized gift card. You can also add a message for the recipient.',
  },
  {
    id: 'o5', category: 'Orders',
    question: 'Can I place a bulk order?',
    answer: 'Absolutely. For orders of 10+ identical or similar items, contact us at bulk@ezihubb.com for custom pricing and a dedicated account manager.',
  },

  // ── Shipping ───────────────────────────────────────────────────────────────
  {
    id: 's1', category: 'Shipping',
    question: 'How much does shipping cost?',
    answer: 'Free standard shipping is applied automatically when an order reaches the current marketplace threshold. Otherwise, shipping cost and delivery time are calculated from the destination and each seller’s delivery profile at checkout.',
  },
  {
    id: 's2', category: 'Shipping',
    question: 'Do you ship internationally?',
    answer: 'Yes, we ship to 50+ countries worldwide. International shipping typically takes 7–14 business days and starts at $14.99. Import duties and taxes are the buyer\'s responsibility.',
  },
  {
    id: 's3', category: 'Shipping',
    question: 'What carriers do you use?',
    answer: 'We ship via USPS, UPS, and FedEx depending on the destination and shipping method. You\'ll receive a carrier and tracking number in your shipping confirmation email.',
  },
  {
    id: 's4', category: 'Shipping',
    question: 'Can I change my delivery address after ordering?',
    answer: 'Address changes can be made within 2 hours of ordering by contacting support. Once shipped, address changes must be requested directly with the carrier.',
  },
  {
    id: 's5', category: 'Shipping',
    question: 'What if my package is lost or damaged in transit?',
    answer: 'All orders are insured. If your package is lost or arrives damaged, contact us within 7 days of the estimated delivery date. We\'ll file a claim and send a replacement at no cost.',
  },

  // ── Returns ────────────────────────────────────────────────────────────────
  {
    id: 'r1', category: 'Returns',
    question: 'Can I return a personalized item?',
    answer: 'Personalized items are non-returnable unless they arrive defective or with a production error. If we made a mistake, we\'ll reprint and ship at no charge.',
  },
  {
    id: 'r2', category: 'Returns',
    question: 'What if my item arrives damaged or incorrect?',
    answer: 'Take a photo of the damage or error and email it to support@ezihubb.com within 7 days of delivery. We\'ll arrange a free replacement or full refund — whichever you prefer.',
  },
  {
    id: 'r3', category: 'Returns',
    question: 'How do I start a return for non-personalized items?',
    answer: 'Visit Account → My Orders, select the order, and click "Return Item". You\'ll receive a prepaid return label via email. Items must be returned within 30 days in original, unused condition.',
  },
  {
    id: 'r4', category: 'Returns',
    question: 'How long do refunds take?',
    answer: 'Once we receive the returned item, refunds are processed within 3–5 business days. The credit will appear on your original payment method within 5–10 business days depending on your bank.',
  },
  {
    id: 'r5', category: 'Returns',
    question: 'Do you offer exchanges?',
    answer: 'For non-personalized items, exchanges are accepted within 30 days. Simply initiate a return and place a new order. We\'ll refund the original purchase once we receive it.',
  },

  // ── Payment ────────────────────────────────────────────────────────────────
  {
    id: 'pay1', category: 'Payment',
    question: 'What payment methods do you accept?',
    answer: 'Online card and PayPal payments are temporarily unavailable while EziHubb completes payment-provider verification. You can submit an order request without being charged; the shop will contact you to confirm availability, the final amount, and next steps.',
  },
  {
    id: 'pay2', category: 'Payment',
    question: 'Is my payment information secure?',
    answer: 'EziHubb does not collect card details during the current order-request flow. Never share your password, verification code, or full card details by message or email. Trust only messages inside your EziHubb account or email from an official @ezihubb.com address.',
  },
  {
    id: 'pay3', category: 'Payment',
    question: 'Can I use a gift card to pay?',
    answer: 'Gift-card redemption at checkout is temporarily paused together with online payments. The shop will confirm the available options when it contacts you about your order request.',
  },
  {
    id: 'pay4', category: 'Payment',
    question: 'When am I charged?',
    answer: 'You are not charged when submitting an order request. The shop will first confirm availability, the final amount, and the next steps with you.',
  },
  {
    id: 'pay5', category: 'Payment',
    question: 'Do you offer buy now, pay later?',
    answer: 'Buy now, pay later is not currently available. We will publish supported payment options clearly when the expanded checkout launches.',
  },
];

const CATEGORIES = ['All', 'Personalization', 'Orders', 'Shipping', 'Returns', 'Payment'];

// ── Accordion item ────────────────────────────────────────────────────────────

function AccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
      >
        <span className="text-sm md:text-base font-semibold text-secondary group-hover:text-primary transition-colors">
          {item.question}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>
      {open && (
        <div className="pb-4 text-sm text-muted leading-relaxed">
          {item.answer}
        </div>
      )}
    </div>
  );
}

// ── Main FAQ client ────────────────────────────────────────────────────────────

export function FaqClient() {
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('All');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FAQ_DATA.filter((item) => {
      const matchCat = category === 'All' || item.category === category;
      const matchQ   = !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [search, category]);

  // Group into categories for display
  const grouped = useMemo(() => {
    const map = new Map<string, FaqItem[]>();
    filtered.forEach((item) => {
      const cat = item.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    });
    return map;
  }, [filtered]);

  return (
    <div>
      {/* ── Hero / search ──────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-primary/8 to-primary/3 py-14 md:py-20">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-secondary mb-4">
            How can we help?
          </h1>
          <p className="text-muted text-base md:text-lg mb-8 max-w-xl mx-auto">
            Browse common questions or search for answers below.
          </p>

          {/* Search */}
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions…"
              className="w-full pl-12 pr-4 py-3.5 text-sm border border-border rounded-button bg-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              aria-label="Search FAQ"
            />
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-10 md:py-14">
        {/* ── Category pills ───────────────────────────────────────────────── */}
        <div
          className="flex flex-wrap gap-2 mb-8"
          role="group"
          aria-label="Filter by category"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
              className={[
                'px-4 py-2 text-sm font-medium rounded-pill border transition-colors',
                category === cat
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-secondary hover:border-primary hover:text-primary',
              ].join(' ')}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Accordion sections ────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="w-10 h-10 text-muted/30 mx-auto mb-3" aria-hidden />
            <p className="font-semibold text-secondary">No results found</p>
            <p className="text-muted text-sm mt-1">
              Try a different search term or category.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {Array.from(grouped.entries()).map(([cat, items]) => (
              <section key={cat} aria-labelledby={`faq-cat-${cat}`}>
                {category === 'All' && (
                  <h2
                    id={`faq-cat-${cat}`}
                    className="font-display text-xl font-bold text-secondary mb-4"
                  >
                    {cat}
                  </h2>
                )}
                <div className="border border-border rounded-card px-5 divide-border">
                  {items.map((item) => (
                    <AccordionItem key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── Still need help? ──────────────────────────────────────────────── */}
        <section className="mt-16 rounded-card border border-border bg-surface p-8 text-center">
          <h2 className="font-display text-2xl font-bold text-secondary mb-2">
            Still have questions?
          </h2>
          <p className="text-muted text-sm mb-6 max-w-sm mx-auto">
            Our support team is available 7 days a week and typically responds within 2 hours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                // Opens Crisp / Intercom widget if available
                if (typeof window !== 'undefined' && (window as Window & { $crisp?: { push: (args: unknown[]) => void } }).$crisp) {
                  (window as Window & { $crisp?: { push: (args: unknown[]) => void } }).$crisp!.push(['do', 'chat:open']);
                }
              }}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold text-sm px-6 py-3 rounded-button transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Start Live Chat
            </button>
            <a
              href="mailto:support@ezihubb.com"
              className="inline-flex items-center gap-2 border border-border text-secondary font-semibold text-sm px-6 py-3 rounded-button hover:border-primary hover:text-primary transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email Support
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
