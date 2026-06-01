import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Account root → forward to orders (primary account section)
export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/account/orders`);
}
