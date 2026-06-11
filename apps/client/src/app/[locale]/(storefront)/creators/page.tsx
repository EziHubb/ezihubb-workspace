import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { ArrowRight, Gift, Share2, DollarSign } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Creator Network — MapleLoom Handmade',
  description: 'Join thousands of creators who share MapleLoom products and earn every time their community shops.',
};

// ── Static data ───────────────────────────────────────────────────────────────

const TIERS = [
  { icon: '🎨', name: 'Creator',        sub: 'Start here',  rate: '10%',   bonus: null,   bg: 'bg-[#F1EFE8]', border: 'border-[#E8E4DF]', text: 'text-secondary', bColor: ''               },
  { icon: '🌱', name: 'Rising Creator', sub: '5+ members',  rate: '10.5%', bonus: '+0.5%',bg: 'bg-[#EAF3DE]', border: 'border-[#C8E6C9]', text: 'text-[#2E7D52]', bColor: 'text-[#2E7D52]' },
  { icon: '⭐', name: 'Top Creator',    sub: '20+ members', rate: '11%',   bonus: '+1%',  bg: 'bg-[#FAEEDA]', border: 'border-[#FDE68A]', text: 'text-[#D97706]', bColor: 'text-[#D97706]', popular: true },
  { icon: '💎', name: 'Elite Creator',  sub: '50+ members', rate: '12%',   bonus: '+2%',  bg: 'bg-[#EEEDFE]', border: 'border-[#C4B5FD]', text: 'text-[#7C3AED]', bColor: 'text-[#7C3AED]' },
] as const;

const STEPS = [
  { icon: Gift,       bg: 'bg-primary',   title: 'Get your creator link', body: 'Every MapleLoom account comes with a unique link. No application needed.' },
  { icon: Share2,     bg: 'bg-[#7C3AED]', title: 'Share anything',        body: 'Post on TikTok, Instagram, Pinterest. Your link works everywhere.' },
  { icon: DollarSign, bg: 'bg-[#2E7D52]', title: 'Earn when they shop',   body: 'Earn 10% when someone buys through your link. Your network earns you more over time.' },
] as const;

const TESTIMONIALS = [
  { quote: 'I made $340 in my first month just by sharing what I already loved. No selling, just sharing.',  name: 'Sarah K.',  handle: '@sarahcrafts'  },
  { quote: "The buyer discount feature is genius. My followers love that they save too — it's a win-win.",    name: 'Marcus T.', handle: '@marcusmakes'  },
  { quote: 'Hit Elite Creator in 6 months. The tiered earnings really motivate you to grow your community.',  name: 'Priya M.',  handle: '@priya_gifting' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CreatorNetworkPage() {
  const locale = await getLocale();

  return (
    <div className="min-h-screen">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(135deg,#FFF0EC 0%,#F3F0FF 100%)' }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">

          {/* Text */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#7C3AED] mb-4">
              MAPLELOOM CREATOR NETWORK
            </p>
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-secondary leading-tight">
              Turn your love for<br className="hidden lg:block" />
              handmade gifts into<br className="hidden lg:block" />
              real earnings
            </h1>
            <p className="text-muted text-base mt-5 max-w-md">
              Join thousands of creators who share MapleLoom products and earn every time their community shops.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href={`/${locale}/auth/register`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-button hover:bg-primary/90 transition-colors">
                Get your creator link <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#how-it-works"
                className="inline-flex items-center gap-1.5 px-6 py-3 border border-secondary/20 text-secondary font-medium rounded-button hover:border-secondary/40 transition-colors">
                See how it works
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-400">★★★★★</span>
                <span className="text-muted">"Earned $340 last month" — @sarahcrafts</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-[#7C3AED]">2,400+</span>
                <span className="text-muted">creators on platform</span>
              </span>
            </div>
          </div>

          {/* Floating cards */}
          <div className="relative hidden lg:flex items-center justify-center h-72">
            <div className="absolute top-0 left-4 bg-white rounded-2xl shadow-xl p-5 w-52 -rotate-3 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-lg flex items-center justify-center">🫙</div>
                <div>
                  <p className="text-xs font-semibold text-secondary">Custom Name Mug</p>
                  <p className="text-xs font-bold text-[#2E7D52]">Sarah earned $2.80</p>
                </div>
              </div>
            </div>
            <div className="absolute top-8 right-0 bg-white rounded-2xl shadow-xl p-5 w-60 rotate-1 z-20">
              <p className="text-xs text-muted mb-2 font-medium">Your creator link</p>
              <div className="flex items-center gap-2 bg-[#FAFAF8] rounded-lg px-3 py-2">
                <span className="text-xs font-mono text-secondary truncate flex-1">mapleloom.com?c=SARAH2024</span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">Copy</span>
              </div>
            </div>
            <div className="absolute bottom-0 right-4 bg-white rounded-2xl shadow-xl p-5 w-48 rotate-2 z-30">
              <span className="text-[10px] font-bold bg-[#7C3AED] text-white px-2 py-0.5 rounded-full">⭐ Top Creator</span>
              <p className="text-2xl font-bold text-[#7C3AED] mt-2">$156.40</p>
              <p className="text-xs text-muted">earned this month</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-3xl font-bold text-secondary">Three steps to start earning</h2>
          <div className="grid md:grid-cols-3 gap-10 mt-12">
            {STEPS.map(({ icon: Icon, title, body, bg }) => (
              <div key={title} className="flex flex-col items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bg}`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h4 className="font-semibold text-secondary">{title}</h4>
                <p className="text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIERS ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-secondary">Grow your creator status</h2>
            <p className="text-muted mt-3">The more your community shops, the more you earn</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((t) => (
              <div key={t.name}
                className={`relative rounded-2xl border p-5 flex flex-col gap-3 ${t.bg} ${t.border}`}>
                {'popular' in t && t.popular && (
                  <span className="absolute -top-2.5 right-4 text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
                    Most popular
                  </span>
                )}
                <span className="text-3xl">{t.icon}</span>
                <div>
                  <h4 className={`font-bold text-sm ${t.text}`}>{t.name}</h4>
                  <p className="text-xs text-muted mt-0.5">{t.sub}</p>
                </div>
                <div className="border-t border-black/5 pt-3 space-y-1">
                  <p className="text-sm font-bold text-secondary">{t.rate} earnings</p>
                  {t.bonus && <p className={`text-xs font-semibold ${t.bColor}`}>{t.bonus} bonus</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUYER DISCOUNT ───────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl font-bold text-secondary">
              Your community gets<br />5% off every purchase
            </h2>
            <p className="text-muted mt-4">
              Anyone who shops through your link automatically gets a discount — no coupon needed.
            </p>
            <Link href={`/${locale}/creators#tiers`}
              className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-5 hover:underline">
              Learn more <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="bg-white border border-border rounded-2xl shadow-xl p-6 space-y-3">
            <p className="font-semibold text-secondary text-sm">Your order</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Custom Name Mug</span>
              <span className="font-medium text-secondary">$27.99</span>
            </div>
            <div className="flex justify-between text-sm text-[#2E7D52]">
              <span className="font-medium">Referral discount</span>
              <span className="font-bold">−$1.40</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between">
              <span className="font-bold text-secondary">Total</span>
              <span className="font-bold text-secondary">$26.59</span>
            </div>
            <div className="flex items-center gap-2 bg-[#FFF0EC] rounded-xl p-3">
              <span>🎁</span>
              <p className="text-xs text-primary font-medium">You're saving 5% — thanks to Sarah!</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="bg-[#F3F0FF] py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-secondary text-center mb-12">
            What creators are saying
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ quote, name, handle }) => (
              <div key={handle} className="bg-white rounded-2xl p-6 space-y-3">
                <span className="text-amber-400 text-sm">★★★★★</span>
                <p className="text-sm text-secondary italic">"{quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-secondary">{name}</p>
                  <p className="text-xs text-muted">{handle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="bg-primary py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-white">Ready to start earning?</h2>
          <p className="text-white/90 mt-3 text-base">Join free. No approval needed. Your link is waiting.</p>
          <Link href={`/${locale}/auth/register`}
            className="inline-flex items-center gap-2 mt-8 px-7 py-3.5 bg-white text-primary font-bold rounded-button hover:bg-white/90 transition-colors">
            Create your account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

    </div>
  );
}
