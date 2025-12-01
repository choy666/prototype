"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterFormValues } from '@/lib/validations/auth';
import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import Link from 'next/link';
import { generateCSRFToken } from '@/lib/utils/csrf';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const router = useRouter();

  // Generar token CSRF al montar el componente
  useEffect(() => {
    setCsrfToken(generateCSRFToken());
  }, []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      documentType: undefined,
      documentNumber: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      setIsSubmitting(true);

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          csrfToken,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Manejar errores de validación
        if (response.status === 400 && responseData.details) {
          // Mostrar el primer error de validación
          const firstError = responseData.details[0];
          return setError(firstError.field as keyof RegisterFormValues, {
            type: 'manual',
            message: firstError.message,
          });
        }
        
        throw new Error(
          responseData.error || 'Error al registrar el usuario. Por favor, inténtalo de nuevo.'
        );
      }

      // Mostrar mensaje de éxito
      toast({
        title: '¡Cuenta creada!',
        description: 'Tu cuenta ha sido creada exitosamente. Por favor inicia sesión.',
      });

      // Redirigir al login después de 1.5 segundos
      setTimeout(() => {
        router.push('/login');
      }, 1500);

    } catch (error) {
      // Mostrar error genérico
      setError('root', {
        type: 'manual',
        message: error instanceof Error ? error.message : 'Error al crear la cuenta',
      });
      
      // Mostrar notificación de error
      toast({
        title: 'Error',
        description: 'No se pudo crear la cuenta. Por favor, verifica los datos e inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-200px)] w-full items-center justify-center bg-black">
      <div className="grid w-full max-w-md gap-8">
        <section className="rounded-3xl bg-gradient-to-r from-[#ff7b00] to-orange-600">
          <div className="m-2 rounded-xl border-8 border-transparent bg-white p-8 shadow-xl dark:bg-gray-900">
            <h1 className="mb-8 cursor-default text-center text-4xl font-bold text-gray-900 dark:text-gray-300">
              Crear cuenta
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {errors.root && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-600">{errors.root.message}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-lg dark:text-gray-300"
                >
                  Nombre completo
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Tu nombre"
                  disabled={isSubmitting}
                  className={`transition duration-300 hover:scale-105 focus:ring-2 focus:ring-[#ff7b00] ${
                    errors.name ? 'border-red-500' : ''
                  }`}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-lg dark:text-gray-300"
                >
                  Correo electrónico
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  disabled={isSubmitting}
                  className={`transition duration-300 hover:scale-105 focus:ring-2 focus:ring-[#ff7b00] ${
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
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={`transition duration-300 hover:scale-105 focus:ring-2 focus:ring-[#ff7b00] ${
                    errors.password ? 'border-red-500' : ''
                  }`}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.password.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Mínimo 8 caracteres, con mayúsculas, minúsculas, números y un carácter especial
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-lg dark:text-gray-300"
                >
                  Confirmar contraseña
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={`transition duration-300 hover:scale-105 focus:ring-2 focus:ring-[#ff7b00] ${
                    errors.confirmPassword ? 'border-red-500' : ''
                  }`}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="documentType"
                  className="mb-2 block text-lg dark:text-gray-300"
                >
                  Tipo de documento (opcional)
                </label>
                <select
                  id="documentType"
                  disabled={isSubmitting}
                  className={`w-full rounded-md border px-3 py-2 text-base outline-none transition duration-300 hover:scale-105 focus:ring-2 focus:ring-[#ff7b00] dark:bg-gray-800 dark:text-gray-100 ${
                    errors.documentType ? 'border-red-500' : ''
                  }`}
                  {...register('documentType')}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="DNI">DNI</option>
                  <option value="CUIT">CUIT</option>
                </select>
                {errors.documentType && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.documentType.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="documentNumber"
                  className="mb-2 block text-lg dark:text-gray-300"
                >
                  Número de documento (opcional)
                </label>
                <Input
                  id="documentNumber"
                  type="text"
                  placeholder="Solo números"
                  disabled={isSubmitting}
                  className={`transition duration-300 hover:scale-105 focus:ring-2 focus:ring-[#ff7b00] ${
                    errors.documentNumber ? 'border-red-500' : ''
                  }`}
                  {...register('documentNumber')}
                />
                {errors.documentNumber && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.documentNumber.message}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#ff7b00] hover:bg-orange-600 text-white text-lg py-3 h-auto focus:ring-[#ff7b00]"
                >
                  {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
                </Button>
              </div>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              ¿Ya tienes una cuenta?{' '}
              <Link
                href="/login"
                className="font-medium text-[#ff7b00] hover:text-orange-600 dark:text-[#ff7b00] dark:hover:text-orange-400"
              >
                Inicia sesión
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}