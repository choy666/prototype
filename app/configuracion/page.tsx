import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Configuración - TechnoCat',
  description: 'Configura tu integración con Tiendanube para sincronizar productos y gestionar órdenes',
};

export default function ConfiguracionPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Configuración de la Aplicación
          </h1>
          
          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">
                Requisitos del Sistema
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Tienda activa en Tiendanube</li>
                <li>Permisos de administrador</li>
                <li>Productos con SKU configurado</li>
                <li>Cuenta activa en Mercado Libre (opcional)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">
                Guía de Instalación
              </h2>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <ol className="list-decimal list-inside space-y-3 text-gray-700">
                  <li>
                    <strong>Conectar tu Tienda</strong>
                    <p className="mt-1 text-sm">
                      Ve al panel de administración y haz clic en &quot;Conectar Tiendanube&quot;
                    </p>
                  </li>
                  <li>
                    <strong>Autorizar la Aplicación</strong>
                    <p className="mt-1 text-sm">
                      Acepta los permisos solicitados en Tiendanube
                    </p>
                  </li>
                  <li>
                    <strong>Sincronizar Productos</strong>
                    <p className="mt-1 text-sm">
                      Usa el botón &quot;Sincronizar Productos&quot; para exportar tu catálogo
                    </p>
                  </li>
                  <li>
                    <strong>Configurar Envíos</strong>
                    <p className="mt-1 text-sm">
                      Activa Mercado Envíos 2.0 para cálculo automático
                    </p>
                  </li>
                </ol>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">
                Características Principales
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-md">
                  <h3 className="font-medium text-green-900">📦 Sincronización de Productos</h3>
                  <p className="mt-1 text-sm text-green-700">
                    Exporta tu catálogo completo con imágenes, precios y stock
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-md">
                  <h3 className="font-medium text-green-900">🚚 Mercado Envíos 2.0</h3>
                  <p className="mt-1 text-sm text-green-700">
                    Calcula costos de envío en tiempo real
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-md">
                  <h3 className="font-medium text-green-900">💳 Mercado Pago Integrado</h3>
                  <p className="mt-1 text-sm text-green-700">
                    Procesa pagos de forma segura
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-md">
                  <h3 className="font-medium text-green-900">📊 Dashboard Administrativo</h3>
                  <p className="mt-1 text-sm text-green-700">
                    Monitorea ventas y sincronización
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">
                Soporte Técnico
              </h2>
              <div className="bg-gray-50 rounded-md p-4">
                <p className="text-gray-700 mb-2">
                  Para obtener ayuda, contacta a nuestro equipo de soporte:
                </p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>📧 Email: soporte@technocat2.mitiendanube.com</li>
                  <li>📚 Documentación: /docs/guia-tienda-tiendanube.md</li>
                  <li>⏰ Horario: Lunes a Viernes, 9:00 - 18:00 (ART)</li>
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
