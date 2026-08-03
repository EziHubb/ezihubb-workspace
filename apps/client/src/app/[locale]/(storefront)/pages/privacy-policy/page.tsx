import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title:       'Privacy Policy — EziHubb',
  description: 'Learn how EziHubb collects, uses, and protects your personal information.',
};

// ── Data ──────────────────────────────────────────────────────────────────────

const LAST_UPDATED  = 'June 15, 2026';
const EFFECTIVE_DATE = 'June 15, 2026';

const TOC = [
  { id: 'information-we-collect', label: '1. Information We Collect' },
  { id: 'how-we-use',             label: '2. How We Use Your Information' },
  { id: 'sharing',                label: '3. Information Sharing' },
  { id: 'cookies',                label: '4. Cookies & Tracking' },
  { id: 'security',               label: '5. Data Security' },
  { id: 'your-rights',            label: '6. Your Privacy Rights' },
  { id: 'retention',              label: '7. Data Retention' },
  { id: 'children',               label: '8. Children\'s Privacy' },
  { id: 'international',          label: '9. International Transfers' },
  { id: 'changes',                label: '10. Changes to Policy' },
  { id: 'contact',                label: '11. Contact Us' },
];

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

export default function PrivacyPolicyPage() {
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
            <span className="text-xs font-semibold text-success uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-secondary mb-4 leading-tight">
            Privacy Policy
          </h1>
          <p className="text-muted max-w-xl text-base leading-relaxed mb-6">
            Your privacy matters to us. This policy explains what personal data we collect, why we collect it, and how you can control it.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span>
              <span className="font-semibold text-secondary">Effective:</span>{' '}
              {EFFECTIVE_DATE}
            </span>
            <span className="text-border">·</span>
            <span>
              <span className="font-semibold text-secondary">Last updated:</span>{' '}
              {LAST_UPDATED}
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
              Contents
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

          <Section id="information-we-collect" title="1. Information We Collect">
            <P>We collect information you provide directly to us and information we collect automatically when you use the Platform.</P>

            <p className="font-semibold text-secondary mt-4">Information you provide:</p>
            <Ul items={[
              'Account details: name, email address, password, and profile photo.',
              'Payment information: billing address and payment method details (processed securely by our payment partners — we do not store card numbers).',
              'Shipping information: delivery addresses for orders.',
              'Content you upload: product photos, personalization files, review text, and messages.',
              'Communications: messages you send to sellers, buyers, or our support team.',
              'Seller information: store name, business details, bank account for payouts (processed by our payment partners).',
            ]} />

            <p className="font-semibold text-secondary mt-4">Information collected automatically:</p>
            <Ul items={[
              'Usage data: pages visited, search queries, clicks, and time spent on the Platform.',
              'Device data: browser type, operating system, IP address, and device identifiers.',
              'Location data: approximate location inferred from IP address.',
              'Transaction data: order history, amounts, and timestamps.',
              'Cookies and similar tracking technologies (see Section 4).',
            ]} />
          </Section>

          <Section id="how-we-use" title="2. How We Use Your Information">
            <P>We use the information we collect to:</P>
            <Ul items={[
              'Create and manage your account.',
              'Process transactions and facilitate payments between buyers and sellers.',
              'Send order confirmations, shipping updates, and receipts.',
              'Respond to your questions and provide customer support.',
              'Personalize your experience and surface relevant products.',
              'Send marketing communications (with your consent, where required).',
              'Detect and prevent fraud, abuse, and other unauthorized activity.',
              'Comply with legal obligations and enforce our Terms of Service.',
              'Analyze usage patterns to improve the Platform.',
              'Communicate Platform updates, policy changes, and important notices.',
            ]} />
            <InfoBox title="Legal Basis (GDPR)">
              <p>For users in the European Economic Area, our legal bases for processing are: contract performance (order fulfillment), legitimate interests (fraud prevention, platform improvement), consent (marketing emails), and legal obligation (tax records).</p>
            </InfoBox>
          </Section>

          <Section id="sharing" title="3. Information Sharing & Disclosure">
            <P>We do not sell your personal information. We share it only in the following circumstances:</P>

            <p className="font-semibold text-secondary mt-4">With sellers and buyers:</p>
            <P>When you place an order, we share your name, shipping address, and order details with the seller. Sellers agree to use this information solely to fulfill your order.</P>

            <p className="font-semibold text-secondary mt-4">With service providers:</p>
            <P>We work with trusted third parties to operate the Platform, including payment processors (Stripe), shipping carriers (EasyPost), email delivery (SendGrid), cloud hosting (Cloudflare R2), and analytics. These providers are contractually bound to protect your data.</P>

            <p className="font-semibold text-secondary mt-4">For legal reasons:</p>
            <P>We may disclose information if required by law, court order, or government authority, or if we believe disclosure is necessary to protect the rights, property, or safety of EziHubb, our users, or the public.</P>

            <p className="font-semibold text-secondary mt-4">Business transfers:</p>
            <P>In the event of a merger, acquisition, or sale of all or substantially all of our assets, your information may be transferred as part of that transaction. We will notify you before your data becomes subject to a different privacy policy.</P>
          </Section>

          <Section id="cookies" title="4. Cookies & Tracking Technologies">
            <P>We use cookies and similar technologies to operate the Platform, remember your preferences, and analyze usage.</P>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-border rounded-card overflow-hidden">
                <thead className="bg-surface">
                  <tr>
                    {['Category', 'Purpose', 'Can opt out?'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted border-b border-border">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['Essential',     'Session management, security, checkout',           'No'],
                    ['Functional',    'Language, currency, and display preferences',       'No'],
                    ['Analytics',     'Page views, usage patterns (Google Analytics)',     'Yes'],
                    ['Marketing',     'Personalised ads and retargeting (Meta Pixel)',     'Yes'],
                  ].map(([cat, purpose, opt]) => (
                    <tr key={cat} className="hover:bg-surface/50">
                      <td className="px-4 py-2.5 font-medium text-secondary">{cat}</td>
                      <td className="px-4 py-2.5 text-muted">{purpose}</td>
                      <td className="px-4 py-2.5 text-muted">{opt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>You can manage cookie preferences via our Cookie Banner or your browser settings. Disabling certain cookies may impact Platform functionality.</P>
          </Section>

          <Section id="security" title="5. Data Security">
            <P>
              We implement industry-standard security measures to protect your information, including TLS encryption for data in transit, AES-256 encryption for sensitive data at rest, and regular security audits.
            </P>
            <P>
              Access to personal data is restricted to employees and contractors who need it to perform their duties, and all such personnel are bound by confidentiality obligations.
            </P>
            <P>
              Despite our efforts, no security measure is perfect. If you believe your account has been compromised, please contact us immediately at security@ezihubb.com.
            </P>
          </Section>

          <Section id="your-rights" title="6. Your Privacy Rights">
            <P>Depending on where you live, you may have the following rights regarding your personal data:</P>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {[
                { right: 'Access',       desc: 'Request a copy of the data we hold about you.' },
                { right: 'Correction',   desc: 'Correct inaccurate or incomplete data.' },
                { right: 'Deletion',     desc: 'Request deletion of your personal data.' },
                { right: 'Portability',  desc: 'Receive your data in a machine-readable format.' },
                { right: 'Restriction',  desc: 'Limit how we process your data in certain situations.' },
                { right: 'Objection',    desc: 'Object to processing based on legitimate interests.' },
                { right: 'Opt-out',      desc: 'Opt out of marketing emails at any time.' },
                { right: 'Withdraw consent', desc: 'Withdraw consent where processing is consent-based.' },
              ].map(({ right, desc }) => (
                <div key={right} className="bg-surface border border-border rounded-lg p-3 text-sm">
                  <p className="font-semibold text-secondary mb-0.5">{right}</p>
                  <p className="text-muted text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <P>
              To exercise any of these rights, email us at privacy@ezihubb.com. We will respond within 30 days (or as required by applicable law). We may need to verify your identity before fulfilling your request.
            </P>
            <P>
              If you are in the EU/EEA, you also have the right to lodge a complaint with your local data protection authority.
            </P>
          </Section>

          <Section id="retention" title="7. Data Retention">
            <P>
              We retain your personal data for as long as your account is active, plus any additional period required to comply with legal obligations (such as tax record-keeping), resolve disputes, and enforce our agreements.
            </P>
            <P>
              Specifically: account data is kept for 2 years after account closure; transaction records are kept for 7 years for tax purposes; marketing consent records are kept for 5 years.
            </P>
            <P>
              You may request deletion of your account and associated data at any time by going to <strong>Account → Settings → Delete Account</strong>, or by emailing privacy@ezihubb.com.
            </P>
          </Section>

          <Section id="children" title="8. Children's Privacy">
            <P>
              The Platform is not directed to children under 13 years of age, and we do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected information from a child, please contact us immediately and we will delete it.
            </P>
            <P>
              For users between 13 and 18, we encourage parental or guardian review and supervision of Platform use.
            </P>
          </Section>

          <Section id="international" title="9. International Data Transfers">
            <P>
              EziHubb operates from the United States. If you are located outside the US, your information may be transferred to and processed in the US or other countries where our service providers operate.
            </P>
            <P>
              For transfers from the European Economic Area (EEA) or United Kingdom, we rely on Standard Contractual Clauses approved by the European Commission to ensure an adequate level of data protection.
            </P>
          </Section>

          <Section id="changes" title="10. Changes to This Policy">
            <P>
              We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of material changes via email or a prominent notice on the Platform.
            </P>
            <P>
              We encourage you to review this Policy periodically. The &ldquo;Last updated&rdquo; date at the top indicates when the most recent changes were made.
            </P>
          </Section>

          <Section id="contact" title="11. Contact Us">
            <P>
              If you have questions about this Privacy Policy or how we handle your data, please contact us:
            </P>
            <div className="mt-4 p-5 bg-surface border border-border rounded-card space-y-2 text-sm">
              <p><span className="font-semibold text-secondary">EziHubb, Inc.</span></p>
              <p>Privacy &amp; Data Protection</p>
              <p>
                <a href="mailto:privacy@ezihubb.com" className="text-primary hover:underline inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  privacy@ezihubb.com
                </a>
              </p>
              <p className="text-muted text-xs pt-1">
                EU/UK users may also contact our Data Protection Officer at dpo@ezihubb.com.
              </p>
            </div>
          </Section>

          {/* Bottom nav */}
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted">
            <p>© 2026 EziHubb, Inc. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/pages/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
              <Link href="/pages/faq" className="hover:text-secondary transition-colors">
                FAQ
              </Link>
              <Link href="/pages/contact" className="hover:text-secondary transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
