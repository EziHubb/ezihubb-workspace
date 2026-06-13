import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShoppingBag, Pencil, Wrench, Truck, Lightbulb,
  ShieldCheck, Lock, Clock, MessageCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'How It Works | DailyDaisy',
    description:
      "Creating a personalized gift is easy. Choose a product, customize it with your photos and names, preview it, and we'll ship it to your door.",
    robots: { index: true, follow: true },
  };
}

// ── Data ──────────────────────────────────────────────────────────────────────

interface Step {
  step:  string;
  title: string;
  desc:  string;
  tip:   string;
  Icon:  LucideIcon;
  image: string;
}

const steps: Step[] = [
  {
    step:  '01',
    title: 'Browse & Choose a Product',
    desc:  'Explore our catalog of 120+ personalized products — from custom mugs and canvas prints to hoodies, ornaments, and more. Filter by occasion, recipient, or category to find the perfect match.',
    tip:   'Use the "Occasions" menu to find gifts for specific events like birthdays or anniversaries.',
    Icon:  ShoppingBag,
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=500&q=80',
  },
  {
    step:  '02',
    title: 'Personalize It Your Way',
    desc:  "Use our easy-to-use customizer to add names, upload photos, choose styles, and write special messages. See a real-time preview of your product as you customize it — no design skills needed.",
    tip:   "Upload the highest quality photo you have for the best print result. We'll optimize it automatically.",
    Icon:  Pencil,
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=500&q=80',
  },
  {
    step:  '03',
    title: 'We Craft It Just for You',
    desc:  'Once you order, our production team gets to work. Every item is made to order — never mass-produced. We use premium materials and professional-grade printing to ensure the highest quality.',
    tip:   'Most orders are in production within 1–2 business days. Rush production is available at checkout.',
    Icon:  Wrench,
    image: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=500&q=80',
  },
  {
    step:  '04',
    title: 'Fast, Safe Delivery',
    desc:  'Your order is carefully packaged and shipped to your door. We offer free standard shipping on orders over $50, and express options if you need it fast. Real-time tracking keeps you updated.',
    tip:   'Order at least 7 days before a gift occasion to receive it comfortably in time.',
    Icon:  Truck,
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&q=80',
  },
];

interface Guarantee {
  Icon:  LucideIcon;
  title: string;
  desc:  string;
}

const guarantees: Guarantee[] = [
  {
    Icon:  ShieldCheck,
    title: 'Quality Guaranteed',
    desc:  "Not happy with your order? Contact us within 30 days and we'll make it right — free replacement or full refund.",
  },
  {
    Icon:  Lock,
    title: 'Secure Checkout',
    desc:  'Shop safely with SSL encryption, Stripe payments, and PayPal. Your payment info is never stored on our servers.',
  },
  {
    Icon:  Clock,
    title: 'On-Time Delivery',
    desc:  "We track every order and proactively contact you if there's any delay. Your gift will arrive when promised.",
  },
  {
    Icon:  MessageCircle,
    title: '24/7 Support',
    desc:  'Real humans ready to help via chat or email. Average response time is under 2 hours during business hours.',
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-16">
        <p className="text-primary font-medium text-sm mb-3 tracking-wide uppercase">
          How It Works
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-secondary mb-4">
          Creating Your Perfect Gift is Simple
        </h1>
        <p className="text-lg text-muted max-w-xl mx-auto">
          From browsing to doorstep in just a few steps. Here&apos;s exactly how the process works.
        </p>
      </div>

      {/* ── Step-by-step ──────────────────────────────────────────────────── */}
      <section className="mb-20">
        {steps.map(({ step, title, desc, tip, Icon, image }, i) => (
          <div
            key={step}
            className={`flex flex-col ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-10 items-center mb-16`}
          >
            {/* Image */}
            <div className="flex-1 relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={title} className="w-full h-full object-cover" />
              </div>
              {/* Step badge */}
              <div className="absolute -top-4 -left-4 w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">{step}</span>
              </div>
            </div>

            {/* Text */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-secondary">{title}</h2>
              </div>
              <p className="text-muted leading-relaxed mb-4">{desc}</p>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-secondary flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span><strong>Tip:</strong> {tip}</span>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Guarantees ────────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] rounded-3xl p-10 mb-16">
        <h2 className="text-2xl font-bold text-secondary text-center mb-8">
          Our Guarantee to You
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {guarantees.map(({ Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-secondary mb-1">{title}</h3>
                <p className="text-sm text-muted leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ teaser ────────────────────────────────────────────────────── */}
      <section className="text-center">
        <p className="text-muted mb-4">Still have questions?</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/pages/faq"
            className="border border-border rounded-full px-5 py-2.5 text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            View Full FAQ
          </Link>
          <Link
            href="/pages/contact"
            className="border border-border rounded-full px-5 py-2.5 text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </section>
    </div>
  );
}
