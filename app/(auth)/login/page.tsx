import { Button } from '@/components/ui/Button';
import { getAuthorizationUrl } from '@/lib/mercadolibre';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function LoginPage() {
  async function handleLogin() {
    'use server';
    const state = Math.random().toString(36).substring(2);
    const url = getAuthorizationUrl(state);
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, { httpOnly: true, secure: true });
    redirect(url);
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md'>
        <h2 className='text-2xl font-bold text-center'>Iniciar Sesión</h2>
        <form action={handleLogin} className='mt-8 space-y-6'>
          <Button type='submit' className='w-full'>
            Iniciar con Mercado Libre
          </Button>
        </form>
      </div>
    </div>
  );
}
