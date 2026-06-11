import Link from 'next/link';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';

// Public stats are server-fetched and cached for 5 min
interface PublicStats {
  totalCreators:    number;
  ordersGenerated:  number;
  totalPaidOut:     number;
  avgEarningsPerCreator: number;
}


const FAQ = [
  {
    q: 'Do I need to apply to join?',
    a: 'No application needed. Any MapleLoom customer can become a creator. Just go to your Creator Hub, grab your link, and start sharing.',
  },
  {
    q: 'How does the buyer discount work?',
    a: 'Anyone who shops through your link automatically gets a discount at checkout — no code needed. It\'s our way of rewarding both you and the people you share with.',
  },
  {
    q: 'When do earnings unlock?',
    a: 'Earnings are held for 14 days after delivery (covers the return window), then move to your confirmed balance. You can request a withdrawal any time once you reach the minimum.',
  },
  {
    q: 'What\'s a Network earning?',
    a: 'When someone you brought to MapleLoom later introduces another person, you earn a small percentage on those sales too — automatically. You don\'t need to do anything extra.',
  },
  {
    q: 'What payment methods are available for withdrawals?',
    a: 'We support PayPal, bank wire transfer, and USDT crypto. Withdrawals are typically processed within 3–5 business days.',
  },
  {
    q: 'Can I use coupon codes on top of the creator discount?',
    a: 'Yes — coupon codes and the creator link discount stack together. Your commission is calculated on the subtotal after coupon discounts.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Get your creator link',
    body: 'Head to your Creator Hub in your account. Your personal link is ready — no setup required.',
  },
  {
    step: '02',
    title: 'Share what you love',
    body: 'Post on social, send to friends, add to your bio. Anyone who clicks your link and shops gets a discount automatically.',
  },
  {
    step: '03',
    title: 'Earn as your community shops',
    body: 'You earn a percentage on every order placed through your link. Earnings unlock after 14 days and can be withdrawn to PayPal, bank, or crypto.',
  },
];

export default async function CreatorsLandingPage() {
  const statsResult = await apiClient
    .get<PublicStats>(API_ROUTES.CREATORS.PUBLIC_STATS, { next: { revalidate: 300 } })
    .catch(() => null);

  const publicStats: PublicStats | null = statsResult ?? null;

  // Programme defaults — update here when admin changes tier structure
  const commissionPct = 5;   // base tier rate
  const discountPct   = 5;   // buyer discount
  const minPayout     = 20;

  const tiers = [
    { name: 'Creator',     minReferrals: 0,  commissionRate: 0.05, badgeColor: '#8B8882', badgeIcon: '✦' },
    { name: 'Rising Star', minReferrals: 5,  commissionRate: 0.07, badgeColor: '#B87333', badgeIcon: '⭐' },
    { name: 'Trendsetter', minReferrals: 20, commissionRate: 0.10, badgeColor: '#9B7EC8', badgeIcon: '💜' },
    { name: 'Icon',        minReferrals: 50, commissionRate: 0.15, badgeColor: '#D4A843', badgeIcon: '👑' },
  ];

  return (
    <div className="bg-background">

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
          <span className="inline-block bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-6">
            Creator Network
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-secondary leading-tight mb-6">
            Share what you love.<br className="hidden md:block" />
            <span className="text-primary">Earn when your community shops.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-8">
            No follower minimum. No application. Just share your creator link —
            earn {commissionPct}% on every order, and your buyers get {discountPct}% off automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/account/creator"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-white font-bold rounded-button hover:bg-primary/90 transition-colors text-base">
              Get your creator link
              <span className="text-white/70 text-xs">→</span>
            </Link>
            <a href="#how-it-works"
              className="inline-flex items-center gap-2 px-6 py-3.5 border border-border text-secondary font-medium rounded-button hover:border-primary/40 transition-colors text-sm">
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────────────────────── */}
      {publicStats && (
        <section className="border-b border-border bg-background">
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold tabular-nums text-secondary">{publicStats.totalCreators.toLocaleString()}+</p>
                <p className="text-xs text-muted mt-1 uppercase tracking-wide">Active creators</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-secondary">${(publicStats.totalPaidOut / 1000).toFixed(0)}k+</p>
                <p className="text-xs text-muted mt-1 uppercase tracking-wide">Total paid out</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-secondary">{publicStats.ordersGenerated.toLocaleString()}+</p>
                <p className="text-xs text-muted mt-1 uppercase tracking-wide">Orders generated</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-secondary">${publicStats.avgEarningsPerCreator.toFixed(0)}</p>
                <p className="text-xs text-muted mt-1 uppercase tracking-wide">Avg. creator earnings</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-4 md:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary">How it works</h2>
          <p className="text-muted mt-3 max-w-xl mx-auto">Three steps — that's all it takes to start earning.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map(({ step, title, body }) => (
            <div key={step} className="relative">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-primary font-bold text-sm">{step}</span>
              </div>
              <h3 className="font-semibold text-secondary text-base mb-2">{title}</h3>
              <p className="text-sm text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CREATOR TIERS ─────────────────────────────────────────────────────── */}
      <section className="bg-surface border-y border-border py-20">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary">Earn more as you grow</h2>
            <p className="text-muted mt-3 max-w-xl mx-auto">
              Bring more people to MapleLoom and your earnings rate increases automatically.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tiers.map((tier, i) => (
              <div key={tier.name}
                className="bg-background border border-border rounded-card p-5 flex flex-col items-center gap-3 text-center relative overflow-hidden">
                {i === tiers.length - 1 && (
                  <div className="absolute top-0 inset-x-0 h-0.5" style={{ backgroundColor: tier.badgeColor }} />
                )}
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: tier.badgeColor + '20', border: `2px solid ${tier.badgeColor}` }}>
                  {tier.badgeIcon}
                </div>
                <div>
                  <p className="font-bold text-secondary text-sm">{tier.name}</p>
                  <p className="text-2xl font-extrabold tabular-nums mt-1" style={{ color: tier.badgeColor }}>
                    {(tier.commissionRate * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted mt-0.5">earnings rate</p>
                </div>
                <p className="text-xs text-muted">
                  {tier.minReferrals === 0 ? 'Everyone starts here' : `${tier.minReferrals}+ direct members`}
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted mt-6">
            Your tier is determined by the number of direct members (people who signed up via your link).
          </p>
        </div>
      </section>

      {/* ── BUYER DISCOUNT ────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              Better together
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-4">
              Your community saves while you earn
            </h2>
            <p className="text-muted leading-relaxed mb-6">
              Every person who shops through your link gets <strong>{discountPct}% off</strong> their order
              automatically — no coupon code, no friction. You earn your commission. They save on every order.
              Everyone wins.
            </p>
            <ul className="space-y-3 text-sm text-muted">
              {[
                'Discount applied at checkout automatically',
                'Stacks with coupon codes',
                'Works on all products',
                'Cookie valid for 30 days after first click',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5 shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-surface border border-border rounded-card p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">Example</p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted">Order subtotal</span>
                <span className="font-semibold text-secondary">$80.00</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-green-700 font-medium">Buyer saves ({discountPct}% off)</span>
                <span className="text-green-700 font-semibold">−${(80 * discountPct / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted">Buyer pays</span>
                <span className="font-semibold text-secondary">${(80 * (1 - discountPct / 100)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 bg-primary/5 rounded-button px-3">
                <span className="text-primary font-semibold">You earn ({commissionPct}%)</span>
                <span className="text-primary font-bold">+${(80 * commissionPct / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────────── */}
      <section className="bg-surface border-y border-border py-20">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-secondary">What creators are saying</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Sarah K.',
                handle: '@sarahcrafts',
                body: 'I just share the products I already buy. My followers love the discount and I\'ve earned over $300 in three months without any extra effort.',
              },
              {
                name: 'Marcus T.',
                handle: '@giftsbymarc',
                body: 'The tier system is a great motivator. I went from 5% to 10% earnings rate in two months just by sharing products I genuinely love.',
              },
              {
                name: 'Linh N.',
                handle: 'Family & friends',
                body: 'I don\'t have a big following — just shared with family group chats. Still made back the cost of my own order in commissions. Totally worth it.',
              },
            ].map(({ name, handle, body }) => (
              <div key={name} className="bg-background border border-border rounded-card p-5 space-y-3">
                <p className="text-sm text-secondary leading-relaxed">"{body}"</p>
                <div>
                  <p className="text-xs font-semibold text-secondary">{name}</p>
                  <p className="text-xs text-muted">{handle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl font-bold text-secondary">Frequently asked questions</h2>
        </div>
        <div className="space-y-4">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="border border-border rounded-card p-5">
              <p className="font-semibold text-secondary text-sm mb-2">{q}</p>
              <p className="text-sm text-muted leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted mt-8">
          More questions?{' '}
          <Link href="/account/messages" className="text-primary hover:underline">Contact us</Link>
        </p>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-20 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-4">
            Ready to start earning?
          </h2>
          <p className="text-muted mb-8 max-w-lg mx-auto">
            Your creator link is waiting. Go to your Creator Hub to grab it — takes 30 seconds.
          </p>
          <Link href="/account/creator"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-button hover:bg-primary/90 transition-colors text-base">
            Go to your Creator Hub
          </Link>
          <p className="text-xs text-muted mt-4">
            Min. payout ${minPayout} · Paid via PayPal, bank, or crypto · No fees deducted
          </p>
        </div>
      </section>

    </div>
  );
}
