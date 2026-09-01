import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';

const HIGHLIGHTS = [
  'Custom-designed by us, not resold',
  'Printed to order, shipped worldwide',
  'Free shipping on qualifying orders',
];

export function BrandPanel() {
  return (
    <div className="relative flex flex-col justify-between h-full px-10 py-12 overflow-hidden bg-gradient-to-br from-primary via-[#D94E32] to-[#C44A2E]">
      {/* Decorative circles */}
      <div aria-hidden="true" className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5 blur-2xl" />
      <div aria-hidden="true" className="absolute bottom-0 -left-16 w-64 h-64 rounded-full bg-black/10 blur-2xl" />

      {/* Top: logo + tagline */}
      <div className="relative z-10">
        <Link href="/" className="inline-flex items-center gap-3 mb-6 hover:opacity-90 transition-opacity">
          <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <span className="font-display font-bold text-2xl text-primary">M</span>
          </div>
          <span className="font-display font-bold text-2xl text-white">
            EziHubb
          </span>
        </Link>

        <h2 className="font-display text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
          Gifts That Tell<br />Their Story
        </h2>
        <p className="text-white/80 text-base leading-relaxed max-w-sm">
          Personalized gifts designed by us and printed on demand — from custom mugs
          to photo canvas prints for every occasion.
        </p>

      </div>

      {/* Middle: highlights */}
      <div className="relative z-10 space-y-3 my-8">
        {HIGHLIGHTS.map((text) => (
          <div
            key={text}
            className="flex items-center gap-2.5 bg-white/12 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3"
          >
            <Star className="w-4 h-4 text-yellow-300 fill-current shrink-0" />
            <p className="text-white text-sm leading-snug">{text}</p>
          </div>
        ))}
      </div>

      {/* Bottom: product image collage */}
      <div className="relative z-10 flex gap-3 h-32">
        {[
          { src: 'https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=200&q=80', alt: 'Custom mug' },
          { src: 'https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=200&q=80', alt: 'Canvas print' },
          { src: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=200&q=80', alt: 'Gift item' },
        ].map((img, i) => (
          <div
            key={i}
            className="relative flex-1 rounded-xl overflow-hidden shadow-lg"
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="100px"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Compact mobile brand strip ────────────────────────────────────────────────

export function BrandStrip() {
  return (
    <Link href="/" className="bg-gradient-to-r from-primary to-[#C44A2E] px-4 py-4 flex items-center gap-3 hover:opacity-95 transition-opacity">
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
        <span className="font-display font-bold text-lg text-primary">M</span>
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold text-white text-base leading-none">
          EziHubb
        </p>
        <p className="text-white/70 text-xs mt-0.5 truncate">
          Gifts that tell their story
        </p>
      </div>
    </Link>
  );
}
