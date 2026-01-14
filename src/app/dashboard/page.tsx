import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Welcome {user.email}</p>
    </main>
  );
}
