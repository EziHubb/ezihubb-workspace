import './global.css';
import { ReactQueryProvider } from '../components/providers/ReactQueryProvider';

export const metadata = {
  title:       'Maple Loom Handmade — Admin',
  description: 'Admin dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  );
}
