import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { CategoryDto } from '@mlh/types';

interface CategoryShowcaseProps {
  categories: CategoryDto[];
  locale: string;
}

// Static fallback shown when API returns no categories
const FALLBACK_CATEGORIES = [
  { id: 'birthday',    slug: 'birthday',    name: 'Birthday',      emoji: '🎂' },
  { id: 'wedding',     slug: 'wedding',     name: 'Wedding',       emoji: '💍' },
  { id: 'anniversary', slug: 'anniversary', name: 'Anniversary',   emoji: '❤️' },
  { id: 'baby',        slug: 'baby',        name: 'Baby',          emoji: '🍼' },
  { id: 'housewarming',slug: 'housewarming',name: 'Housewarming',  emoji: '🏠' },
  { id: 'graduation',  slug: 'graduation',  name: 'Graduation',    emoji: '🎓' },
  { id: 'christmas',   slug: 'christmas',   name: 'Christmas',     emoji: '🎄' },
  { id: 'thank-you',   slug: 'thank-you',   name: 'Thank You',     emoji: '🌸' },
] as const;

// Emoji fallback for API categories without images
const SLUG_EMOJI: Record<string, string> = {
  gifts: '🎁', 'home-living': '🏠', 'drink-barware': '🍺',
  apparel: '👕', accessories: '👜', interests: '⭐',
  birthday: '🎂', wedding: '💍', anniversary: '❤️', baby: '🍼',
  housewarming: '🏠', graduation: '🎓', christmas: '🎄', 'thank-you': '🌸',
  'mothers-day': '🌺', 'fathers-day': '👔', 'valentines-day': '💝', halloween: '🎃',
};

function categoryHref(locale: string, slug: string): string {
  return `/${locale}/search?category=${slug}`;
}

export async function CategoryShowcase({ categories, locale }: CategoryShowcaseProps) {
  const t = await getTranslations({ locale, namespace: 'home' });

  const items: { id: string; slug: string; name: string; imageUrl?: string; emoji?: string }[] =
    categories.length > 0
      ? categories.slice(0, 8).map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          imageUrl: c.imageUrl,
          emoji: SLUG_EMOJI[c.slug] ?? '🎁',
        }))
      : FALLBACK_CATEGORIES.map((c) => ({ ...c }));

  return (
    <section className="bg-surface py-16 md:py-20">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
            {t('categories.title')}
          </h2>
          <p className="text-muted">{t('categories.subtitle')}</p>
        </div>

        {/* Mobile: horizontal scroll. Desktop: 8-col single row */}
        <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-3 md:pb-0 md:grid md:grid-cols-8 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {items.map((cat) => (
            <Link
              key={cat.id}
              href={categoryHref(locale, cat.slug)}
              className="snap-start shrink-0 flex flex-col items-center gap-2.5 group min-w-[80px] md:min-w-0"
            >
              <div className="relative w-[64px] h-[64px] md:w-[72px] md:h-[72px] rounded-full overflow-hidden bg-primary/5 ring-2 ring-transparent group-hover:ring-primary transition-all duration-200 shadow-sm flex-shrink-0">
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt={cat.name}
                    fill
                    sizes="72px"
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-2xl md:text-[28px]">
                    <span role="img" aria-label={cat.name}>{cat.emoji}</span>
                  </div>
                )}
              </div>
              <span className="text-xs md:text-sm font-medium text-secondary text-center leading-tight group-hover:text-primary transition-colors line-clamp-2 max-w-[80px]">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
