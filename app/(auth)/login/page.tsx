'use client';

import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn} from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    const sessionExpired = searchParams?.get('session_expired');
    if (sessionExpired) {
      toast({
        title: 'Sesión expirada',
        description: 'Por favor, inicia sesión nuevamente',
        variant: 'destructive',
      });
    }

    const signedOut = searchParams?.get('signedOut');
    if (signedOut) {
      toast({
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión correctamente',
      });
    }
    const error = searchParams?.get('error');
    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast]);

  const onSubmit = (data: LoginFormValues) => {
      setIsLoading(true);
      signIn('credentials', {
        email: data.email,
        password: data.password,
        callbackUrl,
      });
    };
  return (
    <div className="flex min-h-[calc(100vh-200px)] w-full items-center justify-center bg-black">
      <div className="grid w-full max-w-md gap-8">
        <section className="rounded-3xl bg-gradient-to-r from-blue-500 to-purple-500">
          <div className="m-2 rounded-xl border-8 border-transparent bg-white p-8 shadow-xl dark:bg-gray-900">
            <h1 className="mb-8 cursor-default text-center text-4xl font-bold text-gray-900 dark:text-gray-300">
              Iniciar sesión
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {errors.root && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-600">{errors.root.message}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-lg dark:text-gray-300"
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  disabled={isLoading}
                  className={`w-full rounded-lg border border-gray-300 bg-white p-3 shadow-md transition duration-300 hover:scale-105 focus:ring-2 focus:ring-blue-500 dark:border-gray-300 dark:bg-white dark:text-gray-900 ${
                    errors.email ? 'border-red-500' : ''
                  }`}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-lg dark:text-gray-300"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  disabled={isLoading}
                  className={`w-full rounded-lg border border-gray-300 bg-white p-3 shadow-md transition duration-300 hover:scale-105 focus:ring-2 focus:ring-blue-500 dark:border-gray-300 dark:bg-white dark:text-gray-900 ${
                    errors.password ? 'border-red-500' : ''
                  }`}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
                  >
                    Recordarme
                  </label>
                </div>

                <div className="text-sm">
                  <Link
                    href="/forgot-password"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-lg font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Iniciando sesión...
                    </div>
                  ) : (
                    'Iniciar sesión'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    O continúa con
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => signIn('google', { callbackUrl })}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  <svg
                    className="h-5 w-5"
                    aria-hidden="true"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                  </svg>
                  <span className="ml-2">Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => signIn('mercadolibre', { callbackUrl })}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-transparent bg-[#FFE600] px-4 py-3 text-sm font-medium text-[#2D3277] shadow-sm transition hover:bg-[#f0d900] focus:outline-none focus:ring-2 focus:ring-[#2D3277] focus:ring-offset-2"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M11.9999 0C6.48591 0 2 4.48591 2 10C2 12.465 2.91191 14.7202 4.45455 16.4136L2.90909 22L8.40636 20.0436C9.975 20.6691 11.7127 21 13.4545 21C18.9695 21 23.4545 16.5141 23.4545 12C23.4545 5.48591 18.9695 0 11.9999 0ZM13.4545 19.0909C11.9932 19.0909 10.5591 18.8027 9.24364 18.2473L8.94818 18.1118L5.30273 19.275L6.4 15.8L6.22545 15.4836C5.55273 14.2345 5.13636 12.8273 5.13636 11.3636C5.13636 6.67909 8.86182 2.90909 13.4545 2.90909C18.0473 2.90909 21.5455 6.67909 21.5455 11.3636C21.5455 16.0482 18.0473 19.0909 13.4545 19.0909Z" />
                    <path d="M17.4545 12.7273H15.7273V11H17.4545V12.7273ZM13.4545 12.7273H11.7273V11H13.4545V12.7273ZM9.45455 12.7273H7.72727V11H9.45455V12.7273Z" />
                  </svg>
                  <span className="ml-2">MercadoLibre</span>
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              ¿No tienes una cuenta?{' '}
              <Link
                href="/register"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Regístrate
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}