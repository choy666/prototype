import { auth } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';

export async function requireAdminAuth() {
  const session = await auth();
  
  if (!session || session.user.role !== 'admin') {
    redirect('/api/auth/signin');
  }
  
  return session;
}
