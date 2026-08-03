import type { Metadata } from 'next';
import Link from 'next/link';
import { Heart, Sparkles, Users, ArrowRight } from 'lucide-react';

export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Our Story',
    description:
      'Learn how EziHubb was founded and our mission to create meaningful personalized gifts that bring people closer together.',
    robots: { index: true, follow: true },
  };
}

const values = [
  {
    Icon:  Heart,
    title: 'Every Gift Has a Story',
    desc:  "We believe the most meaningful gifts capture real moments, real relationships, and real love. That's why every item we create starts with your story.",
  },
  {
    Icon:  Sparkles,
    title: 'Quality Without Compromise',
    desc:  "We use premium materials and work only with trusted print partners who share our obsession with quality. If it's not good enough for our family, it won't ship to yours.",
  },
  {
    Icon:  Users,
    title: 'People Over Profit',
    desc:  "We're a small team that cares deeply about our customers. Every message gets a real response, every complaint gets taken seriously, every order gets our full attention.",
  },
];

const stats = [
  { number: '50,000+', label: 'Orders fulfilled' },
  { number: '4.9★',   label: 'Average review rating' },
  { number: '120+',   label: 'Product designs' },
  { number: '30+',    label: 'Countries shipped to' },
];

export default function OurStoryPage() {
  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-16">
        <p className="text-primary font-medium text-sm mb-3 tracking-wide uppercase">
          Our Story
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-secondary leading-tight mb-6">
          Made with Love,<br />Delivered with Care
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          EziHubb was born from a simple belief: the best gifts are the ones
          that tell a story — your story.
        </p>
      </div>

      {/* ── Founding story ────────────────────────────────────────────────── */}
      <section className="grid md:grid-cols-2 gap-12 items-center mb-20">
        <div>
          <h2 className="text-2xl font-bold text-secondary mb-4">How It All Started</h2>
          <p className="text-muted leading-relaxed mb-4">
            In 2019, our founder — a passionate crafter and gift-giver — got tired of
            searching for meaningful presents and coming up empty. Everything on the market
            felt generic, mass-produced, and forgettable.
          </p>
          <p className="text-muted leading-relaxed mb-4">
            So she started making personalized gifts for friends and family: custom mugs with
            inside jokes, canvas prints of meaningful places, ornaments engraved with
            special dates. The response was overwhelming.
          </p>
          <p className="text-muted leading-relaxed">
            What started as a small Etsy shop in a spare bedroom became EziHubb —
            a platform dedicated entirely to the art of personalized giving.
          </p>
        </div>

        <div className="relative">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#F5F1EB]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=600&q=80"
              alt="Our founder at work"
              className="w-full h-full object-cover"
            />
          </div>
          {/* Floating stat card */}
          <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-lg p-4 w-40">
            <p className="text-3xl font-bold text-primary">50K+</p>
            <p className="text-xs text-muted mt-0.5">Happy customers worldwide</p>
          </div>
        </div>
      </section>

      {/* ── Mission + Values ──────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] rounded-3xl p-10 mb-20">
        <h2 className="text-2xl font-bold text-secondary text-center mb-10">
          What We Believe In
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {values.map(({ Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-secondary mb-2">{title}</h3>
              <p className="text-sm text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── By the Numbers ────────────────────────────────────────────────── */}
      <section className="text-center mb-20">
        <h2 className="text-2xl font-bold text-secondary mb-10">By the Numbers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(({ number, label }) => (
            <div key={label}>
              <p className="text-4xl font-bold text-primary">{number}</p>
              <p className="text-sm text-muted mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="text-center bg-primary/5 rounded-3xl p-12">
        <h2 className="text-2xl font-bold text-secondary mb-3">
          Ready to Create Something Special?
        </h2>
        <p className="text-muted mb-6">
          Browse our collection and find the perfect personalized gift for someone you love.
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-primary-dark transition-colors"
        >
          Shop Personalized Gifts
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
