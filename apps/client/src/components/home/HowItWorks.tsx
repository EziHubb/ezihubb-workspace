import { getTranslations } from 'next-intl/server';

interface HowItWorksProps {
  locale: string;
}

const STEPS = [
  { num: 1, icon: '🛍️', titleKey: 'howItWorks.step1.title', descKey: 'howItWorks.step1.description' },
  { num: 2, icon: '✏️', titleKey: 'howItWorks.step2.title', descKey: 'howItWorks.step2.description' },
  { num: 3, icon: '👁️', titleKey: 'howItWorks.step3.title', descKey: 'howItWorks.step3.description' },
  { num: 4, icon: '📦', titleKey: 'howItWorks.step4.title', descKey: 'howItWorks.step4.description' },
] as const;

export async function HowItWorks({ locale }: HowItWorksProps) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <section className="bg-surface py-16 md:py-20">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
            {t('howItWorks.title')}
          </h2>
          <p className="text-muted text-base md:text-lg max-w-xl mx-auto">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        <div className="relative">
          {/* Dashed connecting line — desktop only */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-px border-t-2 border-dashed border-border"
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:gap-6">
            {STEPS.map(({ num, icon, titleKey, descKey }) => (
              <div key={num} className="relative flex md:flex-col items-start md:items-center gap-4 md:gap-0 md:text-center pb-8 md:pb-0">
                {/* Vertical connector for mobile */}
                {num < 4 && (
                  <div
                    aria-hidden="true"
                    className="md:hidden absolute left-[39px] top-[80px] w-0.5 h-8 bg-border"
                  />
                )}

                {/* Step circle */}
                <div className="relative flex-shrink-0 z-10 bg-surface">
                  <div className="w-20 h-20 bg-primary/8 rounded-full flex items-center justify-center text-3xl">
                    <span role="img" aria-hidden="true">{icon}</span>
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {num}
                  </span>
                </div>

                <div className="md:mt-6">
                  <h3 className="font-semibold text-lg text-secondary mb-2">
                    {t(titleKey)}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed">
                    {t(descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
