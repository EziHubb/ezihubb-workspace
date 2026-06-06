import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck, RefreshCw, CreditCard,
  CheckCircle2, XCircle, ArrowLeftRight,
  Package, Mail,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Returns & Exchanges | MapleLoomHandmade',
    description:
      "Our return and exchange policy. Learn what's covered, how to initiate a return, and how we make things right.",
    robots: { index: true, follow: true },
  };
}

// ── Data ──────────────────────────────────────────────────────────────────────

const POLICY_CARDS: {
  Icon:      LucideIcon;
  iconCls:   string;
  bgCls:     string;
  title:     string;
  desc:      string;
}[] = [
  {
    Icon:    ShieldCheck,
    iconCls: 'text-green-600',
    bgCls:   'bg-green-50',
    title:   '30-Day Protection',
    desc:    'Contact us within 30 days of delivery for any quality issue.',
  },
  {
    Icon:    RefreshCw,
    iconCls: 'text-blue-600',
    bgCls:   'bg-blue-50',
    title:   'Free Replacements',
    desc:    'Defective or incorrect items get a free replacement, no return needed.',
  },
  {
    Icon:    CreditCard,
    iconCls: 'text-purple-600',
    bgCls:   'bg-purple-50',
    title:   'Full Refunds',
    desc:    "If we can't fix it, you get 100% of your money back.",
  },
];

interface CoverageItem {
  covered: boolean;
  title:   string;
  desc:    string;
}

const COVERAGE_ITEMS: CoverageItem[] = [
  {
    covered: true,
    title:   'Defective or damaged items',
    desc:    "If your item arrived broken, cracked, or damaged during shipping, we'll replace it immediately.",
  },
  {
    covered: true,
    title:   'Wrong personalization',
    desc:    "If we printed the wrong name, date, or photo — entirely our fault — you get a free replacement.",
  },
  {
    covered: true,
    title:   'Significantly different from description',
    desc:    'If the product looks substantially different from what was shown, contact us for a resolution.',
  },
  {
    covered: true,
    title:   'Lost in transit',
    desc:    "If your order never arrived and tracking shows no updates for 7+ days, we'll resend or refund.",
  },
  {
    covered: false,
    title:   'Buyer typos or input errors',
    desc:    'We print exactly what you enter. Mistakes in your personalization text are not covered, so please proofread carefully.',
  },
  {
    covered: false,
    title:   'Changed your mind',
    desc:    "Since every item is made to order specifically for you, we're unable to accept returns for change of mind.",
  },
  {
    covered: false,
    title:   'Color variation on screens',
    desc:    'Screen colors vary between devices. Minor color differences between screen preview and printed product are normal.',
  },
];

const RESOLUTION_STEPS = [
  {
    step:  '1',
    title: 'Contact us within 30 days',
    desc:  'Reach out via our contact page or email support@mapleloomhandmade.com. Include your order number and a brief description of the issue.',
  },
  {
    step:  '2',
    title: 'Send a photo of the issue',
    desc:  'For quality issues or damage, attach 1–2 clear photos. This helps us understand the problem and process your request faster.',
  },
  {
    step:  '3',
    title: "We'll resolve it within 24 hours",
    desc:  "We typically respond and resolve within 24 business hours. We'll either ship a free replacement or issue a full refund to your original payment method.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReturnsPage() {
  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-14">
        <p className="text-primary font-medium text-sm mb-3 uppercase tracking-wide">
          Returns &amp; Exchanges
        </p>
        <h1 className="font-display text-4xl font-bold text-secondary mb-3">
          Our Promise to You
        </h1>
        <p className="text-muted text-lg max-w-xl mx-auto">
          We want you to love your purchase. If something goes wrong,
          we&apos;ll always make it right.
        </p>
      </div>

      {/* ── Policy summary cards ──────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-5 mb-14">
        {POLICY_CARDS.map(({ Icon, iconCls, bgCls, title, desc }) => (
          <div key={title} className="text-center p-6 border border-border rounded-2xl">
            <div className={`w-12 h-12 ${bgCls} rounded-xl flex items-center justify-center mx-auto mb-3`}>
              <Icon className={`w-5 h-5 ${iconCls}`} />
            </div>
            <p className="font-semibold text-secondary mb-1">{title}</p>
            <p className="text-sm text-muted">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── What's covered ────────────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">What&apos;s Covered</h2>
        <div className="space-y-4">
          {COVERAGE_ITEMS.map(({ covered, title, desc }) => (
            <div
              key={title}
              className={`flex gap-4 p-5 rounded-2xl border ${
                covered
                  ? 'border-green-100 bg-green-50/50'
                  : 'border-[#F3F4F6] bg-[#FAFAF8]'
              }`}
            >
              {covered
                ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                : <XCircle     className="w-5 h-5 text-muted     shrink-0 mt-0.5" />
              }
              <div>
                <p className="font-medium text-secondary text-sm">{title}</p>
                <p className="text-sm text-muted mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How to get a resolution ───────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">How to Get a Resolution</h2>
        <div className="space-y-4">
          {RESOLUTION_STEPS.map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4">
              <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm mt-0.5">
                {step}
              </div>
              <div>
                <p className="font-semibold text-secondary">{title}</p>
                <p className="text-sm text-muted mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cancellations ────────────────────────────────────────────────── */}
      <section className="mb-14 bg-[#FAFAF8] rounded-3xl p-8">
        <h2 className="text-xl font-bold text-secondary mb-4">Order Cancellations</h2>
        <p className="text-muted leading-relaxed mb-4">
          You can cancel your order <strong>within 2 hours</strong> of placing it.
          After that, production may have started and we&apos;re unable to cancel.
        </p>
        <p className="text-muted leading-relaxed mb-5">
          To cancel, go to <strong>My Account → Orders</strong> and click &ldquo;Cancel Order&rdquo;
          on the relevant order, or contact us immediately at support@mapleloomhandmade.com.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Package className="w-4 h-4" />
            View My Orders
          </Link>
          <Link
            href="/pages/contact"
            className="inline-flex items-center gap-2 border border-border text-secondary px-5 py-2.5 rounded-full text-sm font-medium hover:border-primary hover:text-primary transition-colors"
          >
            <Mail className="w-4 h-4" />
            Contact Us
          </Link>
        </div>
      </section>

      {/* ── Exchanges note ────────────────────────────────────────────────── */}
      <section className="text-center border border-border rounded-2xl p-8">
        <ArrowLeftRight className="w-8 h-8 text-primary mx-auto mb-3" />
        <h2 className="text-xl font-bold text-secondary mb-2">Exchanges</h2>
        <p className="text-muted max-w-lg mx-auto mb-4">
          Because our items are personalized to order, traditional exchanges aren&apos;t possible.
          If you&apos;d like a different size, color, or personalization — place a new order and
          contact us about the original. We&apos;ll do our best to accommodate you.
        </p>
        <Link href="/pages/contact" className="text-primary text-sm hover:underline">
          Talk to our team →
        </Link>
      </section>
    </div>
  );
}
