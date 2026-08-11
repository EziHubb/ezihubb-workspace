import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Scale, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title:       'Terms of Service — EziHubb',
  description: 'Read our Terms of Service to understand your rights and responsibilities when shopping with EziHubb.',
};

// ── Components ────────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 mb-12">
      <h2 className="font-display text-xl font-bold text-secondary mb-4 pb-3 border-b border-border">
        {title}
      </h2>
      <div className="space-y-3 text-secondary/80 leading-relaxed text-[15px]">
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-outside ml-5 space-y-1.5">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.terms' });

  const TOC = [
    { id: 'acceptance',        label: t('toc.acceptance')      },
    { id: 'use-of-platform',   label: t('toc.useOfPlatform')   },
    { id: 'accounts',          label: t('toc.accounts')        },
    { id: 'buyer-terms',       label: t('toc.buyerTerms')      },
    { id: 'fees-payments',     label: t('toc.feesPayments')    },
    { id: 'intellectual',      label: t('toc.intellectual')    },
    { id: 'prohibited',        label: t('toc.prohibited')      },
    { id: 'disclaimers',       label: t('toc.disclaimers')     },
    { id: 'governing-law',     label: t('toc.governingLaw')    },
    { id: 'changes',           label: t('toc.changes')         },
    { id: 'contact',           label: t('toc.contact')         },
  ];

  const accountsItems   = t.raw('sections.accounts.items')   as string[];
  const prohibitedItems = t.raw('sections.prohibited.items') as string[];

  return (
    <div className="bg-background min-h-screen">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-surface border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-14 md:py-20 relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">{t('legalLabel')}</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-secondary mb-4 leading-tight">
            {t('title')}
          </h1>
          <p className="text-muted max-w-xl text-base leading-relaxed mb-6">
            {t('subtitle')}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span>
              <span className="font-semibold text-secondary">{t('effectiveLabel')}</span>{' '}
              {t('effectiveDate')}
            </span>
            <span className="text-border">·</span>
            <span>
              <span className="font-semibold text-secondary">{t('lastUpdatedLabel')}</span>{' '}
              {t('lastUpdatedDate')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body: TOC + Content ── */}
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-12 md:py-16 flex gap-12">

        {/* Sticky TOC — desktop only */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
              {t('contentsLabel')}
            </p>
            <nav className="space-y-1">
              {TOC.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block text-sm text-muted hover:text-primary transition-colors py-1 leading-snug"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <article className="flex-1 min-w-0">

          <Section id="acceptance" title={t('sections.acceptance.title')}>
            <P>{t('sections.acceptance.p1')}</P>
            <P>{t('sections.acceptance.p2')}</P>
            <P>{t('sections.acceptance.p3')}</P>
          </Section>

          <Section id="use-of-platform" title={t('sections.useOfPlatform.title')}>
            <P>{t('sections.useOfPlatform.p1')}</P>
            <P>{t('sections.useOfPlatform.p2')}</P>
            <P>{t('sections.useOfPlatform.p3')}</P>
          </Section>

          <Section id="accounts" title={t('sections.accounts.title')}>
            <P>{t('sections.accounts.intro')}</P>
            <Ul items={accountsItems} />
            <P>{t('sections.accounts.outro')}</P>
          </Section>

          <Section id="buyer-terms" title={t('sections.buyerTerms.title')}>
            <P>{t('sections.buyerTerms.p1')}</P>
            <P><strong>{t('sections.buyerTerms.ordersPaymentLabel')}</strong> {t('sections.buyerTerms.ordersPaymentBody')}</P>
            <P><strong>{t('sections.buyerTerms.cancellationsLabel')}</strong> {t('sections.buyerTerms.cancellationsBody')}</P>
            <P>
              <strong>{t('sections.buyerTerms.returnsRefundsLabel')}</strong>{' '}
              {t.rich('sections.buyerTerms.returnsRefundsBody', {
                link: (chunks) => <Link href="../returns" className="text-primary hover:underline">{chunks}</Link>,
              })}
            </P>
            <P><strong>{t('sections.buyerTerms.disputesLabel')}</strong> {t('sections.buyerTerms.disputesBody')}</P>
          </Section>

          <Section id="fees-payments" title={t('sections.feesPayments.title')}>
            <P>{t('sections.feesPayments.p1')}</P>
            <P>{t('sections.feesPayments.p2')}</P>
          </Section>

          <Section id="intellectual" title={t('sections.intellectual.title')}>
            <P>
              <strong>{t('sections.intellectual.platformIpLabel')}</strong> {t('sections.intellectual.platformIpBody')}
            </P>
            <P>
              <strong>{t('sections.intellectual.userContentLabel')}</strong> {t('sections.intellectual.userContentBody')}
            </P>
            <P>
              <strong>{t('sections.intellectual.thirdPartyIpLabel')}</strong> {t('sections.intellectual.thirdPartyIpBody')}
            </P>
          </Section>

          <Section id="prohibited" title={t('sections.prohibited.title')}>
            <P>{t('sections.prohibited.intro')}</P>
            <Ul items={prohibitedItems} />
          </Section>

          <Section id="disclaimers" title={t('sections.disclaimers.title')}>
            <P>{t('sections.disclaimers.p1')}</P>
            <P>{t('sections.disclaimers.p2')}</P>
            <P>{t('sections.disclaimers.p3')}</P>
            <P>{t('sections.disclaimers.p4')}</P>
          </Section>

          <Section id="governing-law" title={t('sections.governingLaw.title')}>
            <P>{t('sections.governingLaw.p1')}</P>
            <P>{t('sections.governingLaw.p2')}</P>
          </Section>

          <Section id="changes" title={t('sections.changes.title')}>
            <P>{t('sections.changes.p1')}</P>
            <P>{t('sections.changes.p2')}</P>
          </Section>

          <Section id="contact" title={t('sections.contact.title')}>
            <P>{t('sections.contact.intro')}</P>
            <div className="mt-4 p-5 bg-surface border border-border rounded-card space-y-2 text-sm">
              <p><span className="font-semibold text-secondary">{t('sections.contact.companyName')}</span></p>
              <p>{t('sections.contact.deptLabel')}</p>
              <p>
                <a href="mailto:legal@ezihubb.com" className="text-primary hover:underline inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  legal@ezihubb.com
                </a>
              </p>
            </div>
          </Section>

          {/* Bottom nav */}
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted">
            <p>{t('footer.copyright')}</p>
            <div className="flex gap-4">
              <Link href="/pages/privacy-policy" className="text-primary hover:underline">
                {t('footer.privacyLink')}
              </Link>
              <Link href="/pages/faq" className="hover:text-secondary transition-colors">
                {t('footer.faqLink')}
              </Link>
              <Link href="/pages/contact" className="hover:text-secondary transition-colors">
                {t('footer.contactLink')}
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
