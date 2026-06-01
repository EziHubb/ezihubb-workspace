import './global.css';
import { ReactQueryProvider } from '../components/providers/ReactQueryProvider';
import { SessionProvider } from '../components/providers/SessionProvider';

export const metadata = {
  title:       'Maple Handmade — Admin',
  description: 'Admin dashboard for Maple Handmade',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-secondary antialiased font-sans">
        <SessionProvider>
          <ReactQueryProvider>
            {children}
          </ReactQueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
