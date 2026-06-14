import Link from 'next/link';

interface OpenShopCtaProps {
  locale: string;
}

const PERKS = [
  { emoji: '🛒', label: 'Miễn phí mở gian hàng' },
  { emoji: '📦', label: 'Quản lý đơn hàng dễ dàng' },
  { emoji: '🤖', label: 'AI hỗ trợ cá nhân hoá sản phẩm' },
  { emoji: '💸', label: 'Nhận thanh toán ngay lập tức' },
];

export function OpenShopCta({ locale }: OpenShopCtaProps) {
  return (
    <section className="py-14 bg-[#111111]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-10">

          {/* Left: icon + copy */}
          <div className="flex items-start gap-5 flex-1">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center shrink-0 relative">
              <span className="text-3xl select-none">🏪</span>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-white">
                Bán hàng thủ công của bạn tại đây ✨
              </h3>
              <p className="text-white/60 mt-1 text-sm">
                Mở gian hàng miễn phí · Tiếp cận hàng nghìn khách hàng · Hỗ trợ 24/7
              </p>
              {/* Perk pills */}
              <div className="flex flex-wrap gap-2 mt-3">
                {PERKS.map(({ emoji, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/70 text-xs px-3 py-1 rounded-full"
                  >
                    {emoji} {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: CTA */}
          <Link
            href={`/${locale}/open-shop`}
            className="shrink-0 bg-primary hover:bg-primary-dark text-white font-bold text-sm uppercase tracking-wide px-8 py-4 rounded-full transition-colors shadow-md hover:shadow-lg whitespace-nowrap"
          >
            Mở gian hàng ngay →
          </Link>
        </div>
      </div>
    </section>
  );
}
