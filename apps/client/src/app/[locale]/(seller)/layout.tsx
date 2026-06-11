import type { Metadata } from 'next';
import SellerLayoutClient from './SellerLayoutClient';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <SellerLayoutClient>{children}</SellerLayoutClient>;
}
