import { Navbar } from '../../../components/layout/Navbar';
import { Footer } from '../../../components/layout/Footer';
import { MobileBottomNav } from '../../../components/layout/MobileBottomNav';

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
      {/* Extra bottom padding on mobile so content clears the fixed MobileBottomNav */}
      <div className="pb-16 md:pb-0">
        <Footer />
      </div>
      <MobileBottomNav />
    </>
  );
}
