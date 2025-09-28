'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Efecto para manejar redirecciones
  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return;

    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard');
    }
  }, [status, router]);

  // Estado de carga
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Si no hay sesión, mostrar solo el loader (ya que se redirigirá)
  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Si el usuario no tiene el rol adecuado, redirigir
  if (session.user.role !== 'admin' && session.user.role !== 'user') {
    router.push('/unauthorized');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const handleSignOut = async () => {
    try {
      await signOut({ 
        redirect: false,
        callbackUrl: '/login'
      });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Panel de Control
          </h1>
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg border border-red-200 dark:border-red-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-300">
            ¡Bienvenido de vuelta, <span className="font-semibold">{session.user.name || 'Usuario'}</span>!
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {session.user.role === 'admin' ? 'Administrador' : 'Usuario'}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Tarjeta de Resumen */}
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6 border border-blue-100 dark:border-blue-800">
            <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200">
              Resumen
            </h3>
            <p className="mt-2 text-blue-600 dark:text-blue-300">
              Contenido del resumen irá aquí.
            </p>
          </div>

          {/* Tarjeta de Actividad Reciente */}
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6 border border-green-100 dark:border-green-800">
            <h3 className="text-lg font-medium text-green-800 dark:text-green-200">
              Actividad Reciente
            </h3>
            <p className="mt-2 text-green-600 dark:text-green-300">
              No hay actividad reciente.
            </p>
          </div>

          {/* Tarjeta de Estadísticas */}
          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-6 border border-purple-100 dark:border-purple-800">
            <h3 className="text-lg font-medium text-purple-800 dark:text-purple-200">
              Estadísticas
            </h3>
            <p className="mt-2 text-purple-600 dark:text-purple-300">
              Estadísticas de la cuenta.
            </p>
          </div>
        </div>

        {/* Sección de Acciones Rápidas */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Acciones Rápidas
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 p-4 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                Ver Perfil
              </span>
            </button>
            <button className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 p-4 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                Configuración
              </span>
            </button>
            <button className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 p-4 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                Mis Pedidos
              </span>
            </button>
            <button 
              className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 p-4 rounded-lg border border-gray-200 dark:border-gray-600 text-center"
              onClick={handleSignOut}
            >
              <span className="block text-sm font-medium text-red-600 dark:text-red-400">
                Cerrar Sesión
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}