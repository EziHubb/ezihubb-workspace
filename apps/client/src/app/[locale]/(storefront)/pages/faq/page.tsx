import type { Metadata } from 'next';
import { FaqClient } from '../../../../../components/pages/FaqClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title:       'FAQ | Maple Handmade',
    description: 'Find answers to common questions about personalization, orders, shipping, returns, and payment.',
    robots:      { index: true, follow: true },
  };
}

export default function FaqPage() {
  return <FaqClient />;
}
