import type { Metadata } from 'next';
import {
  Home, Clock, Heart, TrendingUp, Gift, Users,
  Briefcase, Mail, Lightbulb, Target, Handshake,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Careers',
    description:
      "Join the EziHubb team. We're a small, passionate team creating personalized gifts. See open roles or send us your resume.",
    robots: { index: true, follow: true },
  };
}

// ── Data ──────────────────────────────────────────────────────────────────────

const perks: { Icon: LucideIcon; text: string }[] = [
  { Icon: Home,       text: 'Remote-first culture — work from anywhere' },
  { Icon: Clock,      text: 'Flexible hours — we care about output, not hours' },
  { Icon: Heart,      text: 'Mission-driven work that makes people smile' },
  { Icon: TrendingUp, text: 'Growth opportunities in a fast-moving startup' },
  { Icon: Gift,       text: 'Employee discounts on all our products' },
  { Icon: Users,      text: 'Small team = real ownership and impact' },
];

const values: { Icon: LucideIcon; title: string; desc: string }[] = [
  {
    Icon:  Lightbulb,
    title: 'Creative thinkers',
    desc:  'We value people who see problems as puzzles to be solved creatively.',
  },
  {
    Icon:  Target,
    title: 'Ownership mindset',
    desc:  'Small team means you own your work end-to-end. We trust you to run with it.',
  },
  {
    Icon:  Handshake,
    title: 'Customer obsession',
    desc:  `Everything we do starts with "how does this make our customer's day better?"`,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CareersPage() {
  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-16">
        <p className="text-primary font-medium text-sm mb-3 uppercase tracking-wide">
          Careers
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-secondary mb-4">
          Work at EziHubb
        </h1>
        <p className="text-lg text-muted max-w-xl mx-auto">
          We&apos;re a small team with big ambitions. If you love craftsmanship, creativity,
          and making people happy — we want to hear from you.
        </p>
      </div>

      {/* ── Culture ───────────────────────────────────────────────────────── */}
      <section className="grid md:grid-cols-2 gap-12 items-center mb-20">
        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#F5F1EB]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80"
            alt="Team at work"
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-secondary mb-4">Life at EziHubb</h2>
          <div className="space-y-4">
            {perks.map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-secondary">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Open Roles ────────────────────────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-secondary mb-6">Open Positions</h2>

        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <Briefcase className="w-10 h-10 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-secondary mb-2">
            No open positions right now
          </h3>
          <p className="text-muted text-sm max-w-sm mx-auto mb-6">
            We don&apos;t have any open roles at the moment, but we&apos;re always growing.
            Send us your resume and we&apos;ll keep you in mind for future opportunities.
          </p>
          <a
            href="mailto:careers@ezihubb.com"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Mail className="w-4 h-4" />
            Send Your Resume
          </a>
        </div>
      </section>

      {/* ── Values ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] rounded-3xl p-10">
        <h2 className="text-2xl font-bold text-secondary text-center mb-8">
          What We Look For
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {values.map(({ Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-secondary mb-1">{title}</h3>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
