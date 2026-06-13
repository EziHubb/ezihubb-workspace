import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customize Your Gift | DailyDaisy',
  robots: { index: false, follow: false },
};

export default function CustomizeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
