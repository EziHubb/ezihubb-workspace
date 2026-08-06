import { getTranslations } from 'next-intl/server';

// Honest, non-numeric value props — no fabricated order/customer/rating
// counts (see socialProof.* keys in messages/*/home.json).
const HIGHLIGHTS = [
  'socialProof.madeToOrderLabel',
  'socialProof.designedInHouseLabel',
  'socialProof.usShippingLabel',
] as const;

interface SocialProofProps {
  locale: string;
}

export async function SocialProof({ locale }: SocialProofProps) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <section className="bg-primary/5 border-y border-border py-12 md:py-16">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="grid grid-cols-3 divide-x divide-border text-center">
          {HIGHLIGHTS.map((labelKey) => (
            <div key={labelKey} className="px-4 py-2">
              <p className="font-display text-lg md:text-xl font-bold text-primary mb-1">
                {t(labelKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
