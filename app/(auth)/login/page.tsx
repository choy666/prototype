'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { SiMercadopago } from 'react-icons/si';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'CredentialsSignin') {
      toast({
        title: 'Error',
        description: 'Credenciales inválidas. Por favor, inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast]);

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: data.email,
        password: data.password,
        callbackUrl: '/dashboard',
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.url) {
        router.push(result.url);
      }
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: 'Credenciales inválidas. Por favor, inténtalo de nuevo.',
      });
    }
  };

  const handleMercadoLibreLogin = () => {
    signIn('mercadopago', { callbackUrl: '/dashboard' });
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
                  disabled={isSubmitting}
                  className={`w-full rounded-lg border border-gray-300 p-3 shadow-md transition duration-300 hover:scale-105 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-indigo-700 dark:text-gray-300 ${
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
                  disabled={isSubmitting}
                  className={`w-full rounded-lg border border-gray-300 p-3 shadow-md transition duration-300 hover:scale-105 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-indigo-700 dark:text-gray-300 ${
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

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-lg font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500 dark:bg-gray-900">
                    O continúa con
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleMercadoLibreLogin}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <SiMercadopago className="h-5 w-5" />
                  <span>Iniciar con Mercado Libre</span>
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
