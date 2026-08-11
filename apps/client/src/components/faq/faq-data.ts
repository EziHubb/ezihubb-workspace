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

// Translator function accepted by both useTranslations() (client) and the
// resolved getTranslations() (server) — both are callable as (key) => string.
type Translator = (key: string) => string;

// Module-level data needs the active locale's copy, so it's built from a
// factory that takes the caller's own `t` rather than exported as a static
// constant (mirrors the pattern used for zod schemas/label tables elsewhere).
export function getFaqData(t: Translator): FaqSection[] {
  return [
    {
      category: t('data.categories.ordering'),
      Icon:     Pencil,
      questions: [
        { q: t('data.questions.ordering.q1.q'), a: t('data.questions.ordering.q1.a') },
        { q: t('data.questions.ordering.q2.q'), a: t('data.questions.ordering.q2.a') },
        { q: t('data.questions.ordering.q3.q'), a: t('data.questions.ordering.q3.a') },
        { q: t('data.questions.ordering.q4.q'), a: t('data.questions.ordering.q4.a') },
        { q: t('data.questions.ordering.q5.q'), a: t('data.questions.ordering.q5.a') },
      ],
    },
    {
      category: t('data.categories.production'),
      Icon:     Wrench,
      questions: [
        { q: t('data.questions.production.q1.q'), a: t('data.questions.production.q1.a') },
        { q: t('data.questions.production.q2.q'), a: t('data.questions.production.q2.a') },
        { q: t('data.questions.production.q3.q'), a: t('data.questions.production.q3.a') },
      ],
    },
    {
      category: t('data.categories.shipping'),
      Icon:     Truck,
      questions: [
        { q: t('data.questions.shipping.q1.q'), a: t('data.questions.shipping.q1.a') },
        { q: t('data.questions.shipping.q2.q'), a: t('data.questions.shipping.q2.a') },
        { q: t('data.questions.shipping.q3.q'), a: t('data.questions.shipping.q3.a') },
        { q: t('data.questions.shipping.q4.q'), a: t('data.questions.shipping.q4.a') },
        { q: t('data.questions.shipping.q5.q'), a: t('data.questions.shipping.q5.a') },
      ],
    },
    {
      category: t('data.categories.returns'),
      Icon:     Undo2,
      questions: [
        { q: t('data.questions.returns.q1.q'), a: t('data.questions.returns.q1.a') },
        { q: t('data.questions.returns.q2.q'), a: t('data.questions.returns.q2.a') },
        { q: t('data.questions.returns.q3.q'), a: t('data.questions.returns.q3.a') },
      ],
    },
    {
      category: t('data.categories.account'),
      Icon:     CreditCard,
      questions: [
        { q: t('data.questions.account.q1.q'), a: t('data.questions.account.q1.a') },
        { q: t('data.questions.account.q2.q'), a: t('data.questions.account.q2.a') },
        { q: t('data.questions.account.q3.q'), a: t('data.questions.account.q3.a') },
      ],
    },
  ];
}

export function getFaqFlat(t: Translator): FaqQuestion[] {
  return getFaqData(t).flatMap((s) => s.questions);
}
