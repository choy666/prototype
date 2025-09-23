import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();
  
  // Si no hay sesión, redirigir al login
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard');
  }

  // Si el usuario no tiene el rol adecuado, redirigir
  if (session.user.role !== 'admin' && session.user.role !== 'user') {
    redirect('/unauthorized');
  }


  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Panel de Control
        </h1>
        
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-300">
            ¡Bienvenido de vuelta, <span className="font-semibold">{session.user.name || 'Usuario'}</span>!
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {session.user.role}
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
            <button className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 p-4 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                Soporte
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}