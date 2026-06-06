import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Account | MapleLoomHandmade',
  robots: { index: false, follow: false },
};

export default function AccountPagesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
