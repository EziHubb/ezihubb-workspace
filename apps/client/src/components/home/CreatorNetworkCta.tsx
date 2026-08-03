import Link from 'next/link';

interface Props {
  locale: string;
}

export function CreatorNetworkCta({ locale }: Props) {
  const prefix = locale === 'en' ? '' : `/${locale}`;

  return (
    <section className="border-y border-border bg-surface">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* ── Left: Copy ── */}
          <div>
            <span className="inline-block bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              Creator Network
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary leading-tight mb-4">
              Share EziHubb.<br />
              <span className="text-primary">Earn every time someone shops.</span>
            </h2>
            <p className="text-muted leading-relaxed mb-6 max-w-lg">
              Get your personal creator link. Share it anywhere. Earn a commission on every order —
              and the people you share with get a discount automatically.
              No minimum followers. No application.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href={`${prefix}/account/creator`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-button hover:bg-primary/90 transition-colors text-sm">
                Get your creator link
              </Link>
              <Link href={`${prefix}/creators`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-secondary font-medium rounded-button hover:border-primary/40 transition-colors text-sm">
                Learn more
              </Link>
            </div>
          </div>

          {/* ── Right: Stats grid ── */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Commission', value: 'Up to 15%', sub: 'on every order', color: 'text-primary' },
              { label: 'Buyer discount', value: '5% off',    sub: 'applied automatically', color: 'text-green-700' },
              { label: 'Payout',       value: 'No limit',  sub: 'withdraw anytime', color: 'text-secondary' },
              { label: 'Get started',  value: '30 sec',    sub: 'no application needed', color: 'text-secondary' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-background border border-border rounded-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">{label}</p>
                <p className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</p>
                <p className="text-xs text-muted mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
