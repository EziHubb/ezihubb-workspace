import { getTranslations } from 'next-intl/server';

// Marketing copy — intentionally hardcoded, not fetched from API
const STATS = [
  { value: '2M+',   labelKey: 'socialProof.ordersLabel'    },
  { value: '4.9★',  labelKey: 'socialProof.ratingLabel'    },
  { value: '180K+', labelKey: 'socialProof.customersLabel' },
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
          {STATS.map(({ value, labelKey }) => (
            <div key={labelKey} className="px-4 py-2">
              <p className="font-display text-3xl md:text-4xl font-bold text-primary mb-1">
                {value}
              </p>
              <p className="text-muted text-sm">{t(labelKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
