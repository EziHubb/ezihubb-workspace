import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Star, Truck, ShieldCheck } from 'lucide-react';

interface HeroBannerProps {
  locale: string;
  headline: string;
  subheadline: string;
  ctaPrimary: string;
  ctaSecondary: string;
  trust1: string;
  trust2: string;
  trust3: string;
}

export function HeroBanner({
  locale,
  headline,
  subheadline,
  ctaPrimary,
  ctaSecondary,
  trust1,
  trust2,
  trust3,
}: HeroBannerProps) {
  return (
    <section className="relative min-h-[600px] bg-gradient-to-br from-[#FFF5F0] via-[#FFFBF8] to-[#FEF3E8] overflow-hidden">
      {/* Decorative blobs */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="flex flex-col-reverse md:flex-row items-center gap-10 md:gap-16 py-14 md:py-24">

          {/* ── Text block — bottom on mobile, left on desktop ── */}
          <div className="flex-1 max-w-xl text-center md:text-left">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-secondary leading-tight mb-5">
              {headline}
            </h1>
            <p className="text-base md:text-lg text-muted mb-8 leading-relaxed">
              {subheadline}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start mb-10">
              <Link
                href={`/${locale}/products`}
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-8 py-4 rounded-button transition-colors text-sm uppercase tracking-wide"
              >
                {ctaPrimary}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/${locale}/collections`}
                className="inline-flex items-center justify-center gap-2 border-2 border-primary text-primary font-semibold px-8 py-4 rounded-button hover:bg-primary hover:text-white transition-colors text-sm uppercase tracking-wide"
              >
                {ctaSecondary}
              </Link>
            </div>

            <div className="flex flex-wrap gap-5 justify-center md:justify-start text-sm text-secondary">
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-warning fill-warning flex-shrink-0" />
                {trust1}
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-success flex-shrink-0" />
                {trust2}
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-primary flex-shrink-0" />
                {trust3}
              </span>
            </div>
          </div>

          {/* ── Product collage — top on mobile, right on desktop ── */}
          <div className="flex-1 w-full max-w-[480px]">
            <div className="relative grid grid-cols-2 grid-rows-2 gap-3 h-[380px] md:h-[480px]">
              {/* Tall image spanning both rows */}
              <div className="row-span-2 relative rounded-2xl overflow-hidden shadow-card-hover">
                <Image
                  src="https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=400&q=80"
                  alt="Custom photo mug"
                  fill
                  sizes="(max-width: 768px) 45vw, 22vw"
                  className="object-cover"
                  priority
                />
              </div>
              {/* Top-right image */}
              <div className="relative rounded-2xl overflow-hidden shadow-floating">
                <Image
                  src="https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=300&q=80"
                  alt="Personalized canvas print"
                  fill
                  sizes="(max-width: 768px) 45vw, 18vw"
                  className="object-cover"
                />
              </div>
              {/* Bottom-right image */}
              <div className="relative rounded-2xl overflow-hidden shadow-floating">
                <Image
                  src="https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=300&q=80"
                  alt="Custom throw pillow"
                  fill
                  sizes="(max-width: 768px) 45vw, 18vw"
                  className="object-cover"
                />
              </div>

              {/* Floating rating pill */}
              <div className="absolute -bottom-3 -left-3 bg-white rounded-xl shadow-floating px-3 py-2 flex items-center gap-2.5">
                <span className="text-lg" aria-hidden="true">⭐</span>
                <div>
                  <p className="text-xs font-bold text-secondary leading-none">4.9 / 5</p>
                  <p className="text-xs text-muted">50K+ Reviews</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
