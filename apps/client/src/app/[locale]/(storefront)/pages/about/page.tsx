import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Leaf, Shield, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title:       'About Us',
    description: 'Learn about our mission to create meaningful, personalized handmade gifts crafted with love for every occasion.',
  };
}

// ── Static data ───────────────────────────────────────────────────────────────

const STATS = [
  { value: '50K+',   label: 'Happy Customers'  },
  { value: '2M+',    label: 'Orders Delivered'  },
  { value: '4.9 ★',  label: 'Average Rating'   },
  { value: '500+',   label: 'Products'          },
];

const PROCESS_STEPS = [
  {
    step: '01',
    title: 'You Personalize',
    description:
      'Choose from hundreds of products, upload your photos, add names and messages, then preview your creation before ordering.',
    emoji: '✏️',
  },
  {
    step: '02',
    title: 'We Craft',
    description:
      'Our skilled artisans print and assemble each item by hand using premium materials and professional-grade equipment.',
    emoji: '🛠️',
  },
  {
    step: '03',
    title: 'We Deliver',
    description:
      'Your creation is safely packaged and shipped to your door — or directly to the lucky recipient as a surprise gift.',
    emoji: '📦',
  },
];

const VALUES = [
  {
    icon:  Heart,
    title: 'Made with Love',
    description:
      'Every order is a personal expression of care. We treat each item with the attention it deserves.',
    accent: 'text-error bg-error/8',
  },
  {
    icon:  Shield,
    title: 'Quality First',
    description:
      'We use only premium substrates and professional printing technology to ensure lasting results.',
    accent: 'text-primary bg-primary/8',
  },
  {
    icon:  Leaf,
    title: 'Sustainable',
    description:
      'We use eco-friendly inks, recycled packaging, and carbon-neutral shipping options wherever possible.',
    accent: 'text-success bg-success/8',
  },
  {
    icon:  Users,
    title: 'Customer First',
    description:
      'From personalization to delivery, we\'re with you every step. Our team responds within 2 hours.',
    accent: 'text-warning bg-warning/8',
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="bg-background">

      {/* ── Hero: full-bleed image + headline overlay ── */}
      <section className="relative h-[52vh] md:h-[65vh] overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1615529328331-f8917597711f?w=1600&q=80"
          alt="Artisan crafting a personalized gift"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />

        <div className="absolute inset-0 flex items-end">
          <div className="max-w-[1440px] w-full mx-auto px-4 md:px-8 pb-10 md:pb-16">
            <p className="text-white/80 text-sm font-semibold uppercase tracking-widest mb-3">
              Our Story
            </p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight max-w-2xl">
              Crafting Memories,<br />One Gift at a Time
            </h1>
          </div>
        </div>
      </section>

      {/* ── Mission: 2-col quote / paragraph ── */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <blockquote className="font-display text-2xl md:text-3xl font-bold text-primary italic leading-relaxed">
              &ldquo;The best gifts aren&apos;t bought — they&apos;re created with intention, love, and a personal touch.&rdquo;
            </blockquote>
            <p className="text-muted text-sm mt-4">
              — Sarah Mitchell, Founder &amp; Head Artisan
            </p>
          </div>
          <div className="space-y-4 text-secondary text-base leading-relaxed">
            <p>
              Daily Daisy was born from a simple belief: the most meaningful gifts
              are the ones made uniquely for someone. We started in 2019 as a small
              workshop with two people and a single embroidery machine.
            </p>
            <p>
              Today, we&apos;re a team of 40+ artisans and designers serving customers in
              30+ countries — but our commitment to handcrafted quality has never changed.
              Every mug, canvas print, and tumbler still goes through the same careful process.
            </p>
            <p>
              We believe personalization is more than printing a name. It&apos;s capturing a
              moment, honoring a relationship, and creating something that will be treasured
              for years to come.
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats banner ── */}
      <section className="bg-primary py-12 md:py-16">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-x divide-white/20">
            {STATS.map(({ value, label }) => (
              <div key={label} className="px-4">
                <p className="font-display text-4xl md:text-5xl font-bold text-white mb-1">
                  {value}
                </p>
                <p className="text-white/70 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works / process ── */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
            From Your Vision to Their Hands
          </h2>
          <p className="text-muted max-w-xl mx-auto">
            Our process is simple and joyful — here&apos;s how your gift goes from idea to delivered.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {PROCESS_STEPS.map(({ step, title, description, emoji }) => (
            <div key={step} className="text-center">
              <div className="relative inline-flex items-center justify-center w-20 h-20 bg-primary/8 rounded-full mb-5 text-3xl">
                <span role="img" aria-hidden="true">{emoji}</span>
                <span className="absolute -top-1 -right-1 w-7 h-7 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {step}
                </span>
              </div>
              <h3 className="font-semibold text-xl text-secondary mb-3">{title}</h3>
              <p className="text-muted text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Values ── */}
      <section className="bg-surface py-16 md:py-20 border-t border-border">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
              What We Stand For
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map(({ icon: Icon, title, description, accent }) => (
              <div
                key={title}
                className="border border-border rounded-card p-6 text-center hover:border-primary/40 transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${accent}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-secondary mb-2">{title}</h3>
                <p className="text-muted text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 md:py-20 text-center">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-secondary mb-4">
          Ready to Create Something Special?
        </h2>
        <p className="text-muted mb-8 max-w-sm mx-auto">
          Browse our collection and create a personalized gift they&apos;ll never forget.
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-8 py-3.5 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          Shop Personalized Gifts
        </Link>
      </section>
    </div>
  );
}
