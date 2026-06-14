import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

interface BlindMatchCtaProps {
  locale: string;
}

export async function BlindMatchCta({ locale }: BlindMatchCtaProps) {
  const t = await getTranslations({ locale, namespace: 'home.blindMatchCta' });

  return (
    <section className="py-14 bg-[#1A1A1A]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-5 flex-1">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center shrink-0 relative">
            <span className="text-3xl font-black text-white select-none">?</span>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-ping" />
          </div>
          <div>
            <h3 className="font-display text-2xl font-bold text-white">
              {t('title')}
            </h3>
            <p className="text-white/60 mt-1 text-sm">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <Link
          href={`/${locale}/blind-match`}
          className="shrink-0 bg-primary hover:bg-primary-dark text-white font-bold text-sm uppercase tracking-wide px-8 py-4 rounded-full transition-colors shadow-md hover:shadow-lg"
        >
          {t('cta')}
        </Link>
      </div>
    </section>
  );
}
