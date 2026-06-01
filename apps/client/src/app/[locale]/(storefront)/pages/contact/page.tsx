import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Mail, Package, Clock } from 'lucide-react';
import { ContactForm } from '../../../../../components/pages/ContactForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title:       'Contact Us | Maple Handmade',
    description: 'Get in touch with our support team. Available 7 days a week with replies within 2 hours.',
  };
}

const CONTACT_CARDS = [
  {
    icon:  MessageCircle,
    title: 'Live Chat',
    body:  'Available 24/7',
    action: { label: 'Start Chat', href: '#chat', external: false },
    accent: 'text-primary bg-primary/8',
  },
  {
    icon:  Mail,
    title: 'Email Support',
    body:  'support@maplehandmade.com',
    action: { label: 'Send Email', href: 'mailto:support@maplehandmade.com', external: true },
    accent: 'text-success bg-success/8',
  },
  {
    icon:  Package,
    title: 'Order Issues',
    body:  'Track or manage your orders',
    action: { label: 'Track Order', href: '/orders/track', external: false },
    accent: 'text-warning bg-warning/8',
  },
] as const;

const HOURS = [
  { days: 'Monday – Friday', hours: '9:00 AM – 6:00 PM EST' },
  { days: 'Saturday',        hours: '10:00 AM – 4:00 PM EST' },
  { days: 'Sunday',          hours: '10:00 AM – 2:00 PM EST' },
];

export default function ContactPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16">
      {/* Page header */}
      <div className="text-center mb-12">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
          Get in Touch
        </h1>
        <p className="text-muted text-base md:text-lg max-w-xl mx-auto">
          Our friendly team typically responds within 2 hours, 7 days a week.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 lg:gap-16 items-start">

        {/* Left: Contact form */}
        <section>
          <h2 className="font-semibold text-secondary text-lg mb-6">
            Send us a message
          </h2>
          <ContactForm />
        </section>

        {/* Right: Contact info */}
        <aside className="space-y-6">
          {/* Contact cards */}
          <div className="space-y-3">
            {CONTACT_CARDS.map(({ icon: Icon, title, body, action, accent }) => (
              <div
                key={title}
                className="flex items-start gap-4 border border-border rounded-card p-4"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-secondary text-sm">{title}</p>
                  <p className="text-xs text-muted mt-0.5 truncate">{body}</p>
                </div>
                {action.external ? (
                  <a
                    href={action.href}
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                  >
                    {action.label}
                  </a>
                ) : (
                  <Link
                    href={action.href}
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                  >
                    {action.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Business hours */}
          <div className="border border-border rounded-card p-5">
            <h3 className="font-semibold text-secondary text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted" />
              Business Hours (EST)
            </h3>
            <ul className="space-y-2">
              {HOURS.map(({ days, hours }) => (
                <li key={days} className="flex justify-between text-sm">
                  <span className="text-muted">{days}</span>
                  <span className="font-medium text-secondary">{hours}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted mt-3 pt-3 border-t border-border">
              Live chat is available 24/7. Email responses during business hours only.
            </p>
          </div>

          {/* FAQ link */}
          <div className="bg-primary/5 rounded-card p-4 text-sm text-secondary">
            <p className="font-semibold mb-1">Looking for quick answers?</p>
            <p className="text-muted mb-2 text-xs">
              Check our FAQ for instant help with common questions.
            </p>
            <Link href="/pages/faq" className="text-primary font-medium hover:underline text-xs">
              Browse FAQ →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
