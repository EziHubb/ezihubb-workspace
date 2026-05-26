import { Navbar } from '../../../components/layout/Navbar';
import { Footer } from '../../../components/layout/Footer';

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="pt-16 md:pt-20 min-h-screen">
        {children}
      </main>
      {/* Extra padding on mobile so footer clears the fixed bottom nav (h-16) */}
      <div className="pb-16 md:pb-0">
        <Footer />
      </div>
    </>
  );
}
