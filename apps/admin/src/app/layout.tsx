import './global.css';
import { ReactQueryProvider } from '../components/providers/ReactQueryProvider';
import { SessionProvider } from '../components/providers/SessionProvider';
import { DialogProvider } from '../contexts/DialogContext';
import { AdminThemeProvider } from '../components/providers/AdminThemeProvider';
import { ToastContainer } from '../components/ui/ToastContainer';

export const metadata = {
  title:       'EziHubb — Admin',
  description: 'Admin dashboard for EziHubb',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-secondary antialiased font-sans">
        <AdminThemeProvider>
          <SessionProvider>
            <ReactQueryProvider>
              <DialogProvider>
                {children}
                {/* Module-level toast store — call toast.success/error anywhere, including outside React (e.g. React Query's global onError) */}
                <ToastContainer />
              </DialogProvider>
            </ReactQueryProvider>
          </SessionProvider>
        </AdminThemeProvider>
      </body>
    </html>
  );
}
