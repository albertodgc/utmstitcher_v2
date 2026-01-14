import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AuthCallback({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams.code;

  if (!code) redirect('/login');

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('AUTH CALLBACK ERROR', error);
    redirect('/login?error=auth_failed');
  }

  redirect('/dashboard');
}
