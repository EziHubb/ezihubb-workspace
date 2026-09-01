import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CreditCard, Wallet, ShieldCheck, Globe2, CalendarClock, Send, Landmark } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { buildAlternates } from '../../../../../lib/seo';

export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'EziHubb Payments',
    description:
      'Current EziHubb order-request and payment availability information.',
    robots: { index: true, follow: true },
    alternates: buildAlternates('/pages/payments', locale),
  };
}

const PAYMENT_METHODS = ['Visa', 'Mastercard', 'Amex', 'Discover', 'Apple Pay', 'Google Pay', 'PayPal'];
const ONLINE_PAYMENTS_AVAILABLE = false;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.payments' });

  if (!ONLINE_PAYMENTS_AVAILABLE) {
    const copy = locale === 'vi'
      ? {
          eyebrow: 'CẬP NHẬT THANH TOÁN',
          title: 'EziHubb đang mở rộng thanh toán trực tuyến',
          description: 'EziHubb đang trong giai đoạn ra mắt sớm và hoàn tất xác minh với các đối tác thanh toán. Hiện tại bạn có thể gửi yêu cầu đặt hàng mà không bị thu tiền trên website; shop sẽ chủ động xác nhận tình trạng sản phẩm, số tiền cuối cùng và các bước tiếp theo qua EziHubb Messages hoặc email.',
          security: 'EziHubb không bao giờ yêu cầu mật khẩu, mã xác minh hoặc đầy đủ thông tin thẻ qua tin nhắn hay email. Chỉ tin cậy tin nhắn trong tài khoản EziHubb hoặc email từ địa chỉ @ezihubb.com chính thức.',
          browse: 'Khám phá sản phẩm',
          help: 'Liên hệ hỗ trợ',
        }
      : locale === 'zh'
        ? {
            eyebrow: '支付更新',
            title: 'EziHubb 正在扩展在线支付方式',
            description: 'EziHubb 目前处于提前使用阶段，正在完成支付服务商验证。您现在可以提交订单请求，网站不会向您收费；商家会通过 EziHubb Messages 或电子邮件确认库存、最终金额和下一步。',
            security: 'EziHubb 绝不会通过消息或邮件索要密码、验证码或完整银行卡信息。请仅信任 EziHubb 账户内的消息或来自官方 @ezihubb.com 地址的邮件。',
            browse: '浏览商品',
            help: '联系支持',
          }
        : {
            eyebrow: 'PAYMENT UPDATE',
            title: 'EziHubb is expanding online payment options',
            description: 'EziHubb is in an early-access launch while we complete payment-provider verification. You can currently submit an order request without being charged on the website; the shop will confirm availability, the final amount, and next steps through EziHubb Messages or email.',
            security: 'EziHubb will never ask for your password, verification code, or full card details by message or email. Trust only messages inside your EziHubb account or email from an official @ezihubb.com address.',
            browse: 'Browse products',
            help: 'Contact support',
          };

    return (
      <div className="mx-auto max-w-[760px] px-4 py-16 md:py-24">
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-7 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.eyebrow}</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-secondary md:text-4xl">{copy.title}</h1>
          <p className="mt-4 text-base leading-relaxed text-muted">{copy.description}</p>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-secondary">{copy.security}</p>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href={`/${locale}/search`} className="rounded-full bg-primary px-6 py-3 text-center text-sm font-semibold text-white hover:bg-primary-dark">
              {copy.browse}
            </Link>
            <Link href={`/${locale}/pages/contact`} className="rounded-full border border-border bg-surface px-6 py-3 text-center text-sm font-semibold text-secondary hover:border-primary">
              {copy.help}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const BENEFITS: { Icon: LucideIcon; title: string; desc: string }[] = [
    { Icon: CreditCard,  title: t('benefits.items.methods.title'),  desc: t('benefits.items.methods.desc')  },
    { Icon: Wallet,      title: t('benefits.items.finances.title'), desc: t('benefits.items.finances.desc') },
    { Icon: ShieldCheck, title: t('benefits.items.protection.title'), desc: t('benefits.items.protection.desc') },
  ];

  const STEPS: { step: string; Icon: LucideIcon; title: string; desc: string }[] = [
    { step: '1', Icon: CalendarClock, title: t('howItWorks.steps.schedule.title'), desc: t('howItWorks.steps.schedule.desc') },
    { step: '2', Icon: Send,          title: t('howItWorks.steps.processed.title'), desc: t('howItWorks.steps.processed.desc') },
    { step: '3', Icon: Landmark,      title: t('howItWorks.steps.deposited.title'), desc: t('howItWorks.steps.deposited.desc') },
  ];

  const FAQS = [
    { q: t('faqs.items.why.q'),       a: t('faqs.items.why.a')       },
    { q: t('faqs.items.howToAdd.q'),  a: t('faqs.items.howToAdd.a')  },
    { q: t('faqs.items.fees.q'),      a: t('faqs.items.fees.a')      },
    { q: t('faqs.items.countries.q'), a: t('faqs.items.countries.a') },
  ];

  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-10">
        <p className="text-primary font-medium text-sm mb-3 uppercase tracking-wide">
          {t('eyebrow')}
        </p>
        <h1 className="font-display text-4xl font-bold text-secondary mb-3">
          {t('title')}
        </h1>
        <p className="text-muted text-lg max-w-xl mx-auto">
          {t('subtitle')}
        </p>
      </div>

      {/* ── Payment method badges ────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-2 mb-14">
        {PAYMENT_METHODS.map((name) => (
          <span key={name} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-button text-xs text-secondary bg-[#FAFAF8]">
            <CreditCard className="w-3.5 h-3.5 text-muted" /> {name}
          </span>
        ))}
      </div>

      {/* ── Benefits ──────────────────────────────────────────────────────── */}
      <section className="mb-14">
        <div className="grid sm:grid-cols-3 gap-6">
          {BENEFITS.map(({ Icon, title, desc }) => (
            <div key={title} className="p-6 border border-border rounded-2xl">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-secondary mb-2">{title}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stat + deposit currency ──────────────────────────────────────── */}
      <section className="grid sm:grid-cols-2 gap-4 mb-14">
        <div className="flex items-start gap-4 bg-primary/5 border border-primary/20 rounded-2xl p-5">
          <Globe2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-secondary">{t('depositCurrency.title')}</p>
            <p className="text-sm text-muted mt-1">{t('depositCurrency.desc')}</p>
          </div>
        </div>
        <div className="flex items-start gap-4 bg-[#FAFAF8] border border-border rounded-2xl p-5">
          <ShieldCheck className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-secondary">{t('salesLift.title')}</p>
            <p className="text-sm text-muted mt-1">{t('salesLift.desc')}</p>
          </div>
        </div>
      </section>

      {/* ── Fees ──────────────────────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-3">{t('fees.title')}</h2>
        <p className="text-muted mb-2">{t('fees.desc')}</p>
        <p className="text-xs text-muted">{t('fees.footnote')}</p>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-secondary mb-6">{t('howItWorks.title')}</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map(({ step, Icon, title, desc }) => (
            <div key={step} className="text-center p-6 border border-border rounded-2xl">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted mb-1">{t('howItWorks.stepLabel', { step })}</p>
              <p className="font-semibold text-secondary mb-2">{title}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQs ──────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF8] rounded-3xl p-8 mb-14">
        <h2 className="text-xl font-bold text-secondary mb-6">{t('faqs.title')}</h2>
        <div className="space-y-4">
          {FAQS.map(({ q, a }) => (
            <div key={q}>
              <p className="font-medium text-secondary text-sm">{q}</p>
              <p className="text-sm text-muted mt-1">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="text-center">
        <h2 className="text-xl font-bold text-secondary mb-2">{t('cta.title')}</h2>
        <p className="text-sm text-muted mb-5">{t('cta.subtitle')}</p>
        <Link
          href={`/${locale}/open-shop`}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-colors"
        >
          {t('cta.button')}
        </Link>
      </section>
    </div>
  );
}
