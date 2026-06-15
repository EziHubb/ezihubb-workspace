import type { Metadata } from 'next';
import Link from 'next/link';
import { Scale, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title:       'Terms of Service — Daily Daisy',
  description: 'Read our Terms of Service to understand your rights and responsibilities when using the Daily Daisy marketplace.',
};

// ── Data ──────────────────────────────────────────────────────────────────────

const LAST_UPDATED = 'June 15, 2026';
const EFFECTIVE_DATE = 'June 15, 2026';

const TOC = [
  { id: 'acceptance',        label: '1. Acceptance of Terms' },
  { id: 'use-of-platform',   label: '2. Use of the Platform' },
  { id: 'accounts',          label: '3. Account Registration' },
  { id: 'buyer-terms',       label: '4. Buyer Terms' },
  { id: 'seller-terms',      label: '5. Seller Terms' },
  { id: 'fees-payments',     label: '6. Fees & Payments' },
  { id: 'intellectual',      label: '7. Intellectual Property' },
  { id: 'prohibited',        label: '8. Prohibited Activities' },
  { id: 'disclaimers',       label: '9. Disclaimers & Liability' },
  { id: 'governing-law',     label: '10. Governing Law' },
  { id: 'changes',           label: '11. Changes to Terms' },
  { id: 'contact',           label: '12. Contact Us' },
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
            These Terms govern your use of the Daily Daisy marketplace. Please read them carefully before placing orders or listing products.
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
              By accessing or using the Daily Daisy marketplace (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, you may not use the Platform.
            </P>
            <P>
              These Terms constitute a legally binding agreement between you and Daily Daisy. Your continued use of the Platform following any updates to these Terms constitutes your acceptance of the revised Terms.
            </P>
            <P>
              If you are using the Platform on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
            </P>
          </Section>

          <Section id="use-of-platform" title="2. Use of the Platform">
            <P>
              Daily Daisy is a marketplace connecting independent sellers of handmade, personalized, and artisan goods with buyers. We provide the Platform as a venue; we are not a party to transactions between buyers and sellers unless explicitly stated.
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

          <Section id="buyer-terms" title="4. Buyer Terms">
            <P>
              When you place an order on Daily Daisy, you enter into a contract directly with the seller. Daily Daisy facilitates the transaction but is not the seller.
            </P>
            <P><strong>Orders & Payment:</strong> All orders are subject to seller acceptance. By completing checkout, you authorize payment for the order total, including applicable taxes and shipping fees. Prices are displayed in your selected currency but settled in the seller&apos;s base currency.</P>
            <P><strong>Cancellations:</strong> You may request a cancellation within 2 hours of placing an order if the seller has not yet begun processing. After that window, cancellation is at the seller&apos;s discretion.</P>
            <P><strong>Returns & Refunds:</strong> Personalized and custom-made items may not be eligible for return unless they arrive damaged, defective, or materially different from the listing description. Each seller&apos;s return policy is displayed on their store page.</P>
            <P><strong>Disputes:</strong> If you have a problem with an order, contact the seller directly first. If unresolved within 48 hours, you may open a dispute through our Resolution Center.</P>
          </Section>

          <Section id="seller-terms" title="5. Seller Terms">
            <P>
              To sell on Daily Daisy, you must apply for a seller account and be approved. By becoming a seller, you agree to:
            </P>
            <Ul items={[
              'List only items you are authorized to sell and that you can fulfill.',
              'Accurately describe your products, including materials, dimensions, and processing times.',
              'Fulfill orders within your stated processing time or notify buyers promptly of any delays.',
              'Respond to buyer messages within 24 hours on business days.',
              'Comply with all applicable laws regarding your products, including intellectual property, consumer safety, and export regulations.',
              'Not list counterfeit, infringing, or prohibited items.',
            ]} />
            <P>
              Sellers are independent contractors and not employees, agents, or partners of Daily Daisy. You are solely responsible for your products, customer service, and compliance with applicable laws.
            </P>
            <P>
              Daily Daisy reserves the right to remove listings, suspend, or permanently ban seller accounts that violate these Terms or receive an unacceptable number of buyer complaints.
            </P>
          </Section>

          <Section id="fees-payments" title="6. Fees & Payments">
            <P>
              Daily Daisy charges sellers a commission on each completed sale. The applicable commission rate is displayed in your Seller Hub and may vary by plan type (Commission or Subscription). We may also charge listing fees, payment processing fees, or other fees as described in the Seller Fee Schedule.
            </P>
            <P>
              Payouts to sellers are processed according to the payout schedule displayed in your Seller Hub, subject to any holds for disputes or compliance reviews. We use industry-standard payment processors and do not store your full card or bank account details.
            </P>
            <P>
              Prices on the Platform are displayed inclusive or exclusive of taxes depending on your location. You are responsible for any applicable sales tax, VAT, or customs duties related to your purchases or sales.
            </P>
          </Section>

          <Section id="intellectual" title="7. Intellectual Property">
            <P>
              <strong>Platform IP:</strong> The Daily Daisy name, logo, design, and software are owned by us and protected by intellectual property laws. You may not use them without our prior written consent.
            </P>
            <P>
              <strong>User Content:</strong> By uploading content to the Platform (photos, text, designs), you grant Daily Daisy a non-exclusive, worldwide, royalty-free license to use, display, and reproduce that content solely to operate and promote the Platform. You retain ownership of your content.
            </P>
            <P>
              <strong>Third-party IP:</strong> You must not upload or sell content that infringes another party&apos;s intellectual property rights. If you believe your IP has been infringed, please contact us via our DMCA notice process at legal@dailydaisy.com.
            </P>
          </Section>

          <Section id="prohibited" title="8. Prohibited Activities">
            <P>You agree not to:</P>
            <Ul items={[
              'Use the Platform for any unlawful purpose or to promote illegal activities.',
              'Post false, misleading, or deceptive content.',
              'Harass, threaten, or harm other users.',
              'Attempt to gain unauthorized access to any part of the Platform or other users\' accounts.',
              'Use automated bots, scrapers, or crawlers without our express written permission.',
              'Circumvent, disable, or interfere with security or authentication features.',
              'Engage in market manipulation, fake reviews, or coordinated inauthentic behavior.',
              'Sell products that are illegal, dangerous, or violate third-party rights.',
              'Conduct transactions off-platform to avoid fees.',
            ]} />
          </Section>

          <Section id="disclaimers" title="9. Disclaimers & Limitation of Liability">
            <P>
              THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </P>
            <P>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, DAILY DAISY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM OR TRANSACTIONS CONDUCTED THROUGH IT.
            </P>
            <P>
              OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM OR RELATING TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE GREATER OF (A) $100 USD OR (B) THE TOTAL FEES YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM.
            </P>
            <P>
              Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability, so some of the above may not apply to you.
            </P>
          </Section>

          <Section id="governing-law" title="10. Governing Law">
            <P>
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law principles.
            </P>
            <P>
              Any dispute arising from or relating to these Terms or the Platform that cannot be resolved informally shall be submitted to binding arbitration in accordance with the American Arbitration Association&apos;s Consumer Arbitration Rules. You waive any right to participate in a class action lawsuit or class-wide arbitration.
            </P>
          </Section>

          <Section id="changes" title="11. Changes to Terms">
            <P>
              We may modify these Terms from time to time. When we make material changes, we will notify you via email or a prominent notice on the Platform at least 30 days before the changes take effect.
            </P>
            <P>
              Your continued use of the Platform after the effective date of the revised Terms constitutes your acceptance of the changes. If you do not agree to the new Terms, you must stop using the Platform.
            </P>
          </Section>

          <Section id="contact" title="12. Contact Us">
            <P>
              If you have questions about these Terms of Service, please reach out to us:
            </P>
            <div className="mt-4 p-5 bg-surface border border-border rounded-card space-y-2 text-sm">
              <p><span className="font-semibold text-secondary">Daily Daisy, Inc.</span></p>
              <p>Legal Department</p>
              <p>
                <a href="mailto:legal@dailydaisy.com" className="text-primary hover:underline inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  legal@dailydaisy.com
                </a>
              </p>
            </div>
          </Section>

          {/* Bottom nav */}
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted">
            <p>© 2026 Daily Daisy, Inc. All rights reserved.</p>
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
