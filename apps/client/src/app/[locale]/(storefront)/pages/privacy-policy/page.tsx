import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ShieldCheck, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title:       'Privacy Policy — EziHubb',
  description: 'Learn how EziHubb collects, uses, and protects your personal information.',
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

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-card p-4 text-sm">
      <p className="font-semibold text-primary mb-2">{title}</p>
      <div className="text-secondary/80 space-y-1">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.privacyPolicy' });

  const TOC = [
    { id: 'information-we-collect', label: t('toc.informationWeCollect') },
    { id: 'how-we-use',             label: t('toc.howWeUse')             },
    { id: 'sharing',                label: t('toc.sharing')              },
    { id: 'cookies',                label: t('toc.cookies')              },
    { id: 'security',               label: t('toc.security')             },
    { id: 'your-rights',            label: t('toc.yourRights')           },
    { id: 'retention',              label: t('toc.retention')            },
    { id: 'children',               label: t('toc.children')             },
    { id: 'international',          label: t('toc.international')        },
    { id: 'changes',                label: t('toc.changes')              },
    { id: 'contact',                label: t('toc.contact')              },
  ];

  const providedItems  = t.raw('sections.informationWeCollect.providedItems') as string[];
  const automaticItems = t.raw('sections.informationWeCollect.automaticItems') as string[];
  const howWeUseItems  = t.raw('sections.howWeUse.items') as string[];
  const cookieRows: [string, string, string][] = [
    [t('sections.cookies.table.rows.essential.category'),  t('sections.cookies.table.rows.essential.purpose'),  t('sections.cookies.table.rows.essential.optOut')],
    [t('sections.cookies.table.rows.functional.category'), t('sections.cookies.table.rows.functional.purpose'), t('sections.cookies.table.rows.functional.optOut')],
    [t('sections.cookies.table.rows.analytics.category'),  t('sections.cookies.table.rows.analytics.purpose'),  t('sections.cookies.table.rows.analytics.optOut')],
    [t('sections.cookies.table.rows.marketing.category'),  t('sections.cookies.table.rows.marketing.purpose'),  t('sections.cookies.table.rows.marketing.optOut')],
  ];
  const rightsItems = [
    { right: t('sections.yourRights.rights.access.right'),           desc: t('sections.yourRights.rights.access.desc')           },
    { right: t('sections.yourRights.rights.correction.right'),       desc: t('sections.yourRights.rights.correction.desc')       },
    { right: t('sections.yourRights.rights.deletion.right'),         desc: t('sections.yourRights.rights.deletion.desc')         },
    { right: t('sections.yourRights.rights.portability.right'),      desc: t('sections.yourRights.rights.portability.desc')      },
    { right: t('sections.yourRights.rights.restriction.right'),      desc: t('sections.yourRights.rights.restriction.desc')      },
    { right: t('sections.yourRights.rights.objection.right'),        desc: t('sections.yourRights.rights.objection.desc')        },
    { right: t('sections.yourRights.rights.optOut.right'),           desc: t('sections.yourRights.rights.optOut.desc')           },
    { right: t('sections.yourRights.rights.withdrawConsent.right'),  desc: t('sections.yourRights.rights.withdrawConsent.desc')  },
  ];

  return (
    <div className="bg-background min-h-screen">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-success/8 via-background to-surface border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-success/6 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-14 md:py-20 relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-success" />
            </div>
            <span className="text-xs font-semibold text-success uppercase tracking-widest">{t('legalLabel')}</span>
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

          <Section id="information-we-collect" title={t('sections.informationWeCollect.title')}>
            <P>{t('sections.informationWeCollect.intro')}</P>

            <p className="font-semibold text-secondary mt-4">{t('sections.informationWeCollect.providedLabel')}</p>
            <Ul items={providedItems} />

            <p className="font-semibold text-secondary mt-4">{t('sections.informationWeCollect.automaticLabel')}</p>
            <Ul items={automaticItems} />
          </Section>

          <Section id="how-we-use" title={t('sections.howWeUse.title')}>
            <P>{t('sections.howWeUse.intro')}</P>
            <Ul items={howWeUseItems} />
            <InfoBox title={t('sections.howWeUse.legalBasisTitle')}>
              <p>{t('sections.howWeUse.legalBasisBody')}</p>
            </InfoBox>
          </Section>

          <Section id="sharing" title={t('sections.sharing.title')}>
            <P>{t('sections.sharing.intro')}</P>

            <p className="font-semibold text-secondary mt-4">{t('sections.sharing.providersLabel')}</p>
            <P>{t('sections.sharing.providersBody')}</P>

            <p className="font-semibold text-secondary mt-4">{t('sections.sharing.legalReasonsLabel')}</p>
            <P>{t('sections.sharing.legalReasonsBody')}</P>

            <p className="font-semibold text-secondary mt-4">{t('sections.sharing.transfersLabel')}</p>
            <P>{t('sections.sharing.transfersBody')}</P>
          </Section>

          <Section id="cookies" title={t('sections.cookies.title')}>
            <P>{t('sections.cookies.intro')}</P>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-border rounded-card overflow-hidden">
                <thead className="bg-surface">
                  <tr>
                    {[t('sections.cookies.table.headers.category'), t('sections.cookies.table.headers.purpose'), t('sections.cookies.table.headers.optOut')].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted border-b border-border">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cookieRows.map(([cat, purpose, opt]) => (
                    <tr key={cat} className="hover:bg-surface/50">
                      <td className="px-4 py-2.5 font-medium text-secondary">{cat}</td>
                      <td className="px-4 py-2.5 text-muted">{purpose}</td>
                      <td className="px-4 py-2.5 text-muted">{opt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>{t('sections.cookies.outro')}</P>
          </Section>

          <Section id="security" title={t('sections.security.title')}>
            <P>{t('sections.security.p1')}</P>
            <P>{t('sections.security.p2')}</P>
            <P>{t('sections.security.p3')}</P>
          </Section>

          <Section id="your-rights" title={t('sections.yourRights.title')}>
            <P>{t('sections.yourRights.intro')}</P>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {rightsItems.map(({ right, desc }) => (
                <div key={right} className="bg-surface border border-border rounded-lg p-3 text-sm">
                  <p className="font-semibold text-secondary mb-0.5">{right}</p>
                  <p className="text-muted text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <P>{t('sections.yourRights.contactP')}</P>
            <P>{t('sections.yourRights.euP')}</P>
          </Section>

          <Section id="retention" title={t('sections.retention.title')}>
            <P>{t('sections.retention.p1')}</P>
            <P>{t('sections.retention.p2')}</P>
            <P>{t.rich('sections.retention.p3', { b: (chunks) => <strong>{chunks}</strong> })}</P>
          </Section>

          <Section id="children" title={t('sections.children.title')}>
            <P>{t('sections.children.p1')}</P>
            <P>{t('sections.children.p2')}</P>
          </Section>

          <Section id="international" title={t('sections.international.title')}>
            <P>{t('sections.international.p1')}</P>
            <P>{t('sections.international.p2')}</P>
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
                <a href="mailto:privacy@ezihubb.com" className="text-primary hover:underline inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  privacy@ezihubb.com
                </a>
              </p>
              <p className="text-muted text-xs pt-1">
                {t('sections.contact.euNote')}
              </p>
            </div>
          </Section>

          {/* Bottom nav */}
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted">
            <p>{t('footer.copyright')}</p>
            <div className="flex gap-4">
              <Link href="/pages/terms" className="text-primary hover:underline">
                {t('footer.termsLink')}
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
