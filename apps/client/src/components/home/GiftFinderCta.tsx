import Link from 'next/link';

interface GiftFinderCtaProps {
  locale: string;
}

export function GiftFinderCta({ locale }: GiftFinderCtaProps) {
  return (
    <section className="py-16 bg-[#FFFBEA]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-5 flex-1">
          <span className="text-5xl shrink-0" aria-hidden>🎁</span>
          <div>
            <h3 className="font-display text-2xl font-bold text-secondary">
              Not sure what to give?
            </h3>
            <p className="text-muted mt-1">
              AI finds the perfect gift in 30 seconds — just answer 5 quick questions.
            </p>
          </div>
        </div>
        <Link
          href={`/${locale}/gift-finder`}
          className="shrink-0 bg-primary hover:bg-primary-dark text-white font-bold text-sm uppercase tracking-wide px-8 py-4 rounded-full transition-colors shadow-md hover:shadow-lg"
        >
          Find a gift →
        </Link>
      </div>
    </section>
  );
}
