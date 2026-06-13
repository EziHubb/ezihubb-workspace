import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Mail, Package, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ContactForm } from '../../../../../components/pages/ContactForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Contact Us',
    description:
      'Get in touch with DailyDaisy. We respond to all messages within 2 hours during business hours.',
    robots: { index: true, follow: true },
  };
}

// ── Data ──────────────────────────────────────────────────────────────────────

const CONTACT_CARDS: {
  Icon:    LucideIcon;
  title:   string;
  desc:    string;
  action:  string;
  href:    string;
  accent:  string;
}[] = [
  {
    Icon:   MessageCircle,
    title:  'Live Chat',
    desc:   'Available 24/7',
    action: 'Start a chat →',
    href:   '#chat',
    accent: 'bg-blue-50 text-blue-600',
  },
  {
    Icon:   Mail,
    title:  'Email',
    desc:   'support@dailydaisy.com',
    action: 'Send email →',
    href:   'mailto:support@dailydaisy.com',
    accent: 'bg-green-50 text-green-600',
  },
  {
    Icon:   Package,
    title:  'Order Issues',
    desc:   'Track or manage your order',
    action: 'Track order →',
    href:   '/orders/track',
    accent: 'bg-amber-50 text-amber-600',
  },
];

const HOURS = [
  { day: 'Monday – Friday', hours: '9:00 AM – 6:00 PM EST' },
  { day: 'Saturday',        hours: '10:00 AM – 4:00 PM EST' },
  { day: 'Sunday',          hours: 'Closed' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContactPage() {
  return (
    <div className="max-w-[1000px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-14">
        <p className="text-primary font-medium text-sm mb-3 uppercase tracking-wide">
          Contact Us
        </p>
        <h1 className="font-display text-4xl font-bold text-secondary mb-3">
          We&apos;d Love to Hear from You
        </h1>
        <p className="text-muted text-lg">
          Questions, feedback, or custom orders — we&apos;re here to help.
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_340px] gap-12">

        {/* ── Contact form ──────────────────────────────────────────────── */}
        <ContactForm />

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {CONTACT_CARDS.map(({ Icon, title, desc, action, href, accent }) => {
            const inner = (
              <>
                <div className={`w-12 h-12 ${accent} rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-secondary">{title}</p>
                  <p className="text-sm text-muted mt-0.5">{desc}</p>
                  <p className="text-sm text-primary mt-1 group-hover:underline">{action}</p>
                </div>
              </>
            );
            const cls = 'flex gap-4 p-5 border border-border rounded-2xl hover:border-primary hover:shadow-sm transition-all group block';
            return href.startsWith('/') ? (
              <Link key={title} href={href} className={cls}>{inner}</Link>
            ) : (
              <a key={title} href={href} className={cls}>{inner}</a>
            );
          })}

          {/* Business hours */}
          <div className="border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-secondary mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Business Hours
            </h3>
            <div className="space-y-1.5 text-sm">
              {HOURS.map(({ day, hours }) => (
                <div key={day} className="flex justify-between">
                  <span className="text-muted">{day}</span>
                  <span className="text-secondary font-medium">{hours}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">
              Average response time: <strong>under 2 hours</strong>
            </p>
          </div>

          {/* FAQ link */}
          <div className="bg-primary/5 rounded-2xl p-4 text-sm text-secondary">
            <p className="font-semibold mb-1">Looking for quick answers?</p>
            <p className="text-muted mb-2 text-xs">Check our FAQ for instant help with common questions.</p>
            <Link href="/pages/faq" className="text-primary font-medium hover:underline text-xs">
              Browse FAQ →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
