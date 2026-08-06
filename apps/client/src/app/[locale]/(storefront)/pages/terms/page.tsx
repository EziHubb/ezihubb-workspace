import type { Metadata } from 'next';
import Link from 'next/link';
import { Scale, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title:       'Terms of Service — EziHubb',
  description: 'Read our Terms of Service to understand your rights and responsibilities when shopping with EziHubb.',
};

// ── Data ──────────────────────────────────────────────────────────────────────

const LAST_UPDATED = 'June 15, 2026';
const EFFECTIVE_DATE = 'June 15, 2026';

const TOC = [
  { id: 'acceptance',        label: '1. Acceptance of Terms' },
  { id: 'use-of-platform',   label: '2. Use of the Platform' },
  { id: 'accounts',          label: '3. Account Registration' },
  { id: 'buyer-terms',       label: '4. Orders & Purchases' },
  { id: 'fees-payments',     label: '5. Fees & Payments' },
  { id: 'intellectual',      label: '6. Intellectual Property' },
  { id: 'prohibited',        label: '7. Prohibited Activities' },
  { id: 'disclaimers',       label: '8. Disclaimers & Liability' },
  { id: 'governing-law',     label: '9. Governing Law' },
  { id: 'changes',           label: '10. Changes to Terms' },
  { id: 'contact',           label: '11. Contact Us' },
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TermsPage() {
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
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-secondary mb-4 leading-tight">
            Terms of Service
          </h1>
          <p className="text-muted max-w-xl text-base leading-relaxed mb-6">
            These Terms govern your use of EziHubb. Please read them carefully before placing an order.
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

          <Section id="acceptance" title="1. Acceptance of Terms">
            <P>
              By accessing or using EziHubb (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, you may not use the Platform.
            </P>
            <P>
              These Terms constitute a legally binding agreement between you and EziHubb. Your continued use of the Platform following any updates to these Terms constitutes your acceptance of the revised Terms.
            </P>
            <P>
              If you are using the Platform on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
            </P>
          </Section>

          <Section id="use-of-platform" title="2. Use of the Platform">
            <P>
              EziHubb designs and sells personalized, print-on-demand gifts directly to you. Every product on the Platform is our own — we are the seller of record for every order.
            </P>
            <P>You must be at least 18 years old to create an account or make purchases. By using the Platform, you represent that you meet this age requirement.</P>
            <P>You agree to use the Platform only for lawful purposes and in accordance with these Terms. You are responsible for ensuring that your use complies with all applicable local, national, and international laws and regulations.</P>
          </Section>

          <Section id="accounts" title="3. Account Registration">
            <P>To access certain features, you must register for an account. When you do, you agree to:</P>
            <Ul items={[
              'Provide accurate, current, and complete information during registration.',
              'Maintain and promptly update your account information.',
              'Keep your password secure and not share it with third parties.',
              'Notify us immediately of any unauthorized use of your account.',
              'Accept responsibility for all activities that occur under your account.',
            ]} />
            <P>
              We reserve the right to suspend or terminate accounts that provide inaccurate information, violate these Terms, or engage in fraudulent activity.
            </P>
          </Section>

          <Section id="buyer-terms" title="4. Orders & Purchases">
            <P>
              When you place an order on EziHubb, you enter into a contract directly with us. Every product is designed by EziHubb and printed to order — we are the seller of record for every item on the Platform.
            </P>
            <P><strong>Orders & Payment:</strong> By completing checkout, you authorize payment for the order total, including applicable taxes and shipping fees.</P>
            <P><strong>Cancellations:</strong> You may request a cancellation within 2 hours of placing an order, before production begins. After that window, cancellation is at our discretion since production has already started.</P>
            <P><strong>Returns & Refunds:</strong> Personalized and custom-made items may not be eligible for return unless they arrive damaged, defective, or materially different from the listing description. See our full <Link href="../returns" className="text-primary hover:underline">Returns Policy</Link> for details.</P>
            <P><strong>Disputes:</strong> If you have a problem with an order, contact us directly and we&apos;ll work to resolve it.</P>
          </Section>

          <Section id="fees-payments" title="5. Fees & Payments">
            <P>
              Prices on the Platform are displayed inclusive or exclusive of taxes depending on your location. You are responsible for any applicable sales tax, VAT, or customs duties related to your purchase.
            </P>
            <P>
              We use industry-standard payment processors and do not store your full card details.
            </P>
          </Section>

          <Section id="intellectual" title="6. Intellectual Property">
            <P>
              <strong>Platform IP:</strong> The EziHubb name, logo, design, and software are owned by us and protected by intellectual property laws. You may not use them without our prior written consent.
            </P>
            <P>
              <strong>User Content:</strong> By uploading content to the Platform (photos, text, designs), you grant EziHubb a non-exclusive, worldwide, royalty-free license to use, display, and reproduce that content solely to operate and promote the Platform. You retain ownership of your content.
            </P>
            <P>
              <strong>Third-party IP:</strong> You must not upload or sell content that infringes another party&apos;s intellectual property rights. If you believe your IP has been infringed, please contact us via our DMCA notice process at legal@ezihubb.com.
            </P>
          </Section>

          <Section id="prohibited" title="7. Prohibited Activities">
            <P>You agree not to:</P>
            <Ul items={[
              'Use the Platform for any unlawful purpose or to promote illegal activities.',
              'Post false, misleading, or deceptive content.',
              'Harass, threaten, or harm other users.',
              'Attempt to gain unauthorized access to any part of the Platform or other users\' accounts.',
              'Use automated bots, scrapers, or crawlers without our express written permission.',
              'Circumvent, disable, or interfere with security or authentication features.',
              'Engage in market manipulation, fake reviews, or coordinated inauthentic behavior.',
              'Resell items purchased from EziHubb in a way that misrepresents them as your own designs.',
            ]} />
          </Section>

          <Section id="disclaimers" title="8. Disclaimers & Limitation of Liability">
            <P>
              THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </P>
            <P>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, EZIHUBB SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM OR TRANSACTIONS CONDUCTED THROUGH IT.
            </P>
            <P>
              OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM OR RELATING TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE GREATER OF (A) $100 USD OR (B) THE TOTAL FEES YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM.
            </P>
            <P>
              Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability, so some of the above may not apply to you.
            </P>
          </Section>

          <Section id="governing-law" title="9. Governing Law">
            <P>
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law principles.
            </P>
            <P>
              Any dispute arising from or relating to these Terms or the Platform that cannot be resolved informally shall be submitted to binding arbitration in accordance with the American Arbitration Association&apos;s Consumer Arbitration Rules. You waive any right to participate in a class action lawsuit or class-wide arbitration.
            </P>
          </Section>

          <Section id="changes" title="10. Changes to Terms">
            <P>
              We may modify these Terms from time to time. When we make material changes, we will notify you via email or a prominent notice on the Platform at least 30 days before the changes take effect.
            </P>
            <P>
              Your continued use of the Platform after the effective date of the revised Terms constitutes your acceptance of the changes. If you do not agree to the new Terms, you must stop using the Platform.
            </P>
          </Section>

          <Section id="contact" title="11. Contact Us">
            <P>
              If you have questions about these Terms of Service, please reach out to us:
            </P>
            <div className="mt-4 p-5 bg-surface border border-border rounded-card space-y-2 text-sm">
              <p><span className="font-semibold text-secondary">EziHubb, Inc.</span></p>
              <p>Legal Department</p>
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
            <p>© 2026 EziHubb, Inc. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/pages/privacy-policy" className="text-primary hover:underline">
                Privacy Policy
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
