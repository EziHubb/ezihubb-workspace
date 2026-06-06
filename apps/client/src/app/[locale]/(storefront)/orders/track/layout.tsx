import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track Your Order | MapleLoomHandmade',
  robots: { index: false, follow: false },
};

export default function OrderTrackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
