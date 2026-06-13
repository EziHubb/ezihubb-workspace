import type { LucideIcon } from 'lucide-react';
import { Pencil, Wrench, Truck, Undo2, CreditCard } from 'lucide-react';

export interface FaqQuestion {
  q: string;
  a: string;
}

export interface FaqSection {
  category: string;
  Icon:     LucideIcon;
  questions: FaqQuestion[];
}

export const FAQ_DATA: FaqSection[] = [
  {
    category: 'Ordering & Personalization',
    Icon:     Pencil,
    questions: [
      {
        q: 'How do I personalize a product?',
        a: "After choosing a product, click \"Personalize Now\" to open our customizer. You can add names, upload photos, choose styles, and enter messages. You'll see a real-time preview before adding to cart.",
      },
      {
        q: 'What file formats are accepted for photo uploads?',
        a: "We accept JPG, PNG, WEBP, and HEIC (iPhone photos). For best results, use a photo with at least 1000×1000 pixels. We'll let you know if the quality is too low.",
      },
      {
        q: 'Can I order a product without personalization?',
        a: 'Most of our products are designed to be personalized, but some can be ordered as-is. Products with an "Add to Cart" button (without personalization required) can be purchased immediately.',
      },
      {
        q: 'Can I make changes to my order after placing it?',
        a: "Yes — but only within 2 hours of ordering. After that, production may have started and changes aren't possible. Contact us immediately at support@dailydaisy.com for changes.",
      },
      {
        q: 'Do you accept custom orders not shown on the website?',
        a: "Yes! We love custom orders. Contact us via the Contact page and describe what you're looking for. We handle custom orders for events, corporate gifting, and bulk orders.",
      },
    ],
  },
  {
    category: 'Production & Quality',
    Icon:     Wrench,
    questions: [
      {
        q: 'How long does production take?',
        a: 'Most items are produced within 3–7 business days after ordering. Rush production (1–2 days) is available at checkout for most products.',
      },
      {
        q: 'What materials and printing methods do you use?',
        a: 'It depends on the product. Mugs are ceramic with dye-sublimation printing. Canvas prints use giclée UV printing on poly-cotton canvas. Apparel uses DTG (direct-to-garment) printing on premium cotton. Specific details are on each product page.',
      },
      {
        q: "What if the quality of my order doesn't meet expectations?",
        a: "We stand behind every item. If you're not satisfied, contact us within 30 days with a photo of the issue and we'll send a free replacement or provide a full refund — no questions asked.",
      },
    ],
  },
  {
    category: 'Shipping & Delivery',
    Icon:     Truck,
    questions: [
      {
        q: 'How long does shipping take?',
        a: 'Standard shipping within the US takes 5–10 business days after production. Express shipping (2–3 days) is available. International shipping takes 14–21 business days.',
      },
      {
        q: 'Do you offer free shipping?',
        a: 'Yes! All US orders over $50 ship free. International orders over $100 qualify for discounted shipping. Free shipping is automatically applied at checkout.',
      },
      {
        q: 'Can I track my order?',
        a: "Absolutely. Once your order ships, you'll receive an email with a tracking number. You can also track your order anytime at dailydaisy.com/orders/track.",
      },
      {
        q: 'Do you ship internationally?',
        a: 'We ship to 30+ countries worldwide. Shipping costs and delivery times vary by destination. Enter your address at checkout for an exact quote. Note: customs duties may apply for international orders.',
      },
      {
        q: 'My order says "delivered" but I haven\'t received it — what should I do?',
        a: "First, check with neighbors and any safe spots around your property. If still missing, contact us within 7 days of the marked delivery date. We'll work with the carrier to locate it or send a replacement.",
      },
    ],
  },
  {
    category: 'Returns & Refunds',
    Icon:     Undo2,
    questions: [
      {
        q: 'Can I return a personalized item?',
        a: "Personalized items generally can't be returned because they're made just for you. However, if there's a defect, wrong personalization, or damage in shipping, we'll replace it for free or issue a full refund.",
      },
      {
        q: 'What if I made a typo in my personalization?',
        a: 'We print exactly what you enter — typos included. Please double-check all text before ordering. If you notice an error within 2 hours of ordering, contact us immediately.',
      },
      {
        q: 'How long do refunds take?',
        a: 'Once approved, refunds are processed within 2–3 business days. Depending on your bank, it may take an additional 3–5 business days to appear on your statement.',
      },
    ],
  },
  {
    category: 'Account & Payment',
    Icon:     CreditCard,
    questions: [
      {
        q: 'Do I need an account to order?',
        a: 'No, you can check out as a guest. However, creating an account lets you track orders, save addresses, and access your customization history — making future orders faster.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit cards (Visa, Mastercard, Amex), PayPal, Apple Pay, and Google Pay. Gift cards purchased from us can also be applied at checkout.',
      },
      {
        q: 'Is my payment information secure?',
        a: "Yes. We use Stripe for payment processing — one of the most secure payment platforms available. We never store your full card details on our servers.",
      },
    ],
  },
];

export const FAQ_FLAT = FAQ_DATA.flatMap((s) => s.questions);
