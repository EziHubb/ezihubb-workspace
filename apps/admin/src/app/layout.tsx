import './global.css';
import { ReactQueryProvider } from '../components/providers/ReactQueryProvider';
import { SessionProvider } from '../components/providers/SessionProvider';
import { DialogProvider } from '../contexts/DialogContext';
import { AdminThemeProvider } from '../components/providers/AdminThemeProvider';

export const metadata = {
  title:       'Daily Daisy — Admin',
  description: 'Admin dashboard for Daily Daisy',
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
              </DialogProvider>
            </ReactQueryProvider>
          </SessionProvider>
        </AdminThemeProvider>
      </body>
    </html>
  );
}
