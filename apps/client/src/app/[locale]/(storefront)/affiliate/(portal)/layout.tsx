import type { Metadata } from 'next';
import AffiliatePortalLayoutClient from './AffiliatePortalLayoutClient';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AffiliatePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AffiliatePortalLayoutClient>{children}</AffiliatePortalLayoutClient>;
}
