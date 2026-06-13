import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Set New Password | DailyDaisy',
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
