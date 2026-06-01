import { redirect } from 'next/navigation';

// Root redirects to dashboard; middleware protects all non-login routes
export default function AdminRoot() {
  redirect('/dashboard');
}
