import type { Metadata } from 'next';
import Link from 'next/link';
import { Info, Package, Wrench, Truck, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Shipping Information',
    description:
      'Learn about our shipping rates, delivery times, tracking, and international shipping at DailyDaisy.',
    robots: { index: true, follow: true },
  };
}

// ── Data ──────────────────────────────────────────────────────────────────────

const DOMESTIC_RATES = [
  { method: 'Standard Shipping',  time: '5–10 business days', cost: '$5.99 (Free over $50)' },
  { method: 'Express Shipping',   time: '2–3 business days',  cost: '$14.99'                 },
  { method: 'Overnight Shipping', time: '1 business day',     cost: '$29.99'                 },
];

const INTERNATIONAL_RATES = [
  { region: 'Canada',           time: '7–14 business days',  cost: '$12.99' },
  { region: 'United Kingdom',   time: '10–18 business days', cost: '$14.99' },
  { region: 'European Union',   time: '10–21 business days', cost: '$14.99' },
  { region: 'Australia & NZ',   time: '14–21 business days', cost: '$16.99' },
  { region: 'Vietnam & SE Asia',time: '14–25 business days', cost: '$15.99' },
  { region: 'Rest of World',    time: '14–30 business days', cost: '$19.99' },
];

const TRACKING_STEPS: { step: string; Icon: LucideIcon; title: string; desc: string }[] = [
  {
    step:  '1',
    Icon:  Package,
    title: 'Order Confirmed',
    desc:  "You'll receive an email confirmation immediately after ordering.",
  },
  {
    step:  '2',
    Icon:  Wrench,
    title: 'In Production',
    desc:  "We'll email you when your item enters production (usually within 24 hours).",
  },
  {
    step:  '3',
    Icon:  Truck,
    title: 'Shipped',
    desc:  "You'll receive a tracking number via email. Track at any time in your account.",
  },
];

const SHIPPING_FAQS = [
  {
    q: 'What happens if my order is lost in transit?',
    a: "Contact us within 30 days of the expected delivery date. We'll file a claim with the carrier and send you a free replacement.",
  },
  {
    q: 'Can I change my shipping address after ordering?',
    a: 'Address changes are possible within 2 hours of ordering. After that, the order may already be processed. Contact us immediately.',
  },
  {
    q: 'Do you ship to PO boxes?',
    a: 'Yes, for standard USPS shipping. Express and overnight options require a physical address.',
  },
];

// ── Reusable table ────────────────────────────────────────────────────────────

function ShippingTable({
  headers,
  rows,
}: {
  headers: string[];
  rows:     string[][];
}) {
  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#F9FAFB] border-b border-border">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-5 py-3.5 font-semibold text-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row[0]} className="hover:bg-[#FAFAF8] transition-colors">
              <td className="px-5 py-4 font-medium text-secondary">{row[0]}</td>
              <td className="px-5 py-4 text-muted">{row[1]}</td>
              <td className="px-5 py-4 text-muted">{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShippingInfoPage() {
  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-14">
        <p className="text-primary font-medium text-sm mb-3 uppercase tracking-wide">
          Shipping Information
        </p>
        <h1 className="font-display text-4xl font-bold text-secondary mb-3">
          Fast, Reliable Delivery
        </h1>
        <p className="text-muted text-lg max-w-xl mx-auto">
          We ship every order with care and provide real-time tracking so you always know
          where your gift is.
        </p>
      </div>

      {/* ── Production time notice ────────────────────────────────────────── */}
      <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-12">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-secondary">Important: Production Time Comes First</p>
          <p className="text-sm text-muted mt-1">
            Since every item is made to order, production takes 3–7 business days before your
            order ships. The shipping times below are in addition to production time. Rush
            production (1–2 days) is available at checkout.
          </p>
        </div>
      </div>

      {/* ── Domestic rates ────────────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">
          Domestic Shipping (United States)
        </h2>
        <ShippingTable
          headers={['Method', 'Delivery Time', 'Cost']}
          rows={DOMESTIC_RATES.map((r) => [r.method, r.time, r.cost])}
        />
        <p className="text-xs text-muted mt-3">
          * Free shipping on orders over $50 is automatically applied at checkout. Not
          combinable with gift card purchases.
        </p>
      </section>

      {/* ── International rates ───────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">International Shipping</h2>
        <ShippingTable
          headers={['Region', 'Delivery Time', 'Starting From']}
          rows={INTERNATIONAL_RATES.map((r) => [r.region, r.time, r.cost])}
        />
        <div className="mt-3 p-4 bg-[#FAFAF8] rounded-xl text-sm text-muted space-y-1">
          <p>⚠️ International orders may be subject to customs duties and import taxes.</p>
          <p>These fees are the responsibility of the recipient and are not included in our prices.</p>
          <p>Free international shipping on orders over $100.</p>
        </div>
      </section>

      {/* ── Tracking steps ────────────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">Order Tracking</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {TRACKING_STEPS.map(({ step, Icon, title, desc }) => (
            <div key={step} className="text-center p-6 border border-border rounded-2xl">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted mb-1">Step {step}</p>
              <p className="font-semibold text-secondary mb-2">{title}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/orders/track"
            className="inline-flex items-center gap-2 border border-primary text-primary px-6 py-2.5 rounded-full text-sm font-medium hover:bg-primary/5 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Track Your Order
          </Link>
        </div>
      </section>

      {/* ── Shipping FAQs ─────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] rounded-3xl p-8">
        <h2 className="text-xl font-bold text-secondary mb-6">Common Shipping Questions</h2>
        <div className="space-y-4">
          {SHIPPING_FAQS.map(({ q, a }) => (
            <div key={q}>
              <p className="font-medium text-secondary text-sm">{q}</p>
              <p className="text-sm text-muted mt-1">{a}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-5 border-t border-border text-center">
          <p className="text-sm text-muted mb-3">More questions?</p>
          <Link href="/pages/faq" className="text-primary text-sm hover:underline">
            View Full FAQ →
          </Link>
        </div>
      </section>
    </div>
  );
}
