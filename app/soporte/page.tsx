import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Soporte - TechnoCat',
  description: 'Centro de soporte técnico para la aplicación TechnoCat Tiendanube',
};

export default function SoportePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Centro de Soporte Técnico
          </h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contacto Rápido */}
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-blue-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  📞 Canales de Contacto
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Email Principal</h3>
                      <p className="text-sm text-gray-600">soporte@technocat2.mitiendanube.com</p>
                      <p className="text-xs text-gray-500 mt-1">Respuesta en 24 horas hábiles</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Chat en Vivo</h3>
                      <p className="text-sm text-gray-600">Disponible en el panel de administración</p>
                      <p className="text-xs text-gray-500 mt-1">Lunes a Viernes, 9:00 - 18:00 (ART)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Sistema de Tickets</h3>
                      <p className="text-sm text-gray-600">Crea un ticket en tu panel de administración</p>
                      <p className="text-xs text-gray-500 mt-1">Seguimiento 24/7</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Problemas Comunes */}
              <section>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  🔧 Problemas Comunes y Soluciones
                </h2>
                <div className="space-y-4">
                  <details className="bg-gray-50 rounded-lg p-4">
                    <summary className="font-medium text-gray-900 cursor-pointer">
                      Los productos no se sincronizan
                    </summary>
                    <div className="mt-3 text-sm text-gray-600 space-y-2">
                      <p>• Verifica que todos los productos tengan SKU configurado</p>
                      <p>• Revisa los permisos de la aplicación en Tiendanube</p>
                      <p>• Intenta sincronizar manualmente desde el panel</p>
                      <p>• Si persiste, contacta a soporte con el ID de tu tienda</p>
                    </div>
                  </details>
                  
                  <details className="bg-gray-50 rounded-lg p-4">
                    <summary className="font-medium text-gray-900 cursor-pointer">
                      Error al conectar con Mercado Libre
                    </summary>
                    <div className="mt-3 text-sm text-gray-600 space-y-2">
                      <p>• Verifica que tus credenciales de ML sean correctas</p>
                      <p>• Asegúrate de tener el plan profesional en ML</p>
                      <p>• Revisa que el callback URL esté configurado correctamente</p>
                      <p>• Intenta desconectar y volver a conectar</p>
                    </div>
                  </details>
                  
                  <details className="bg-gray-50 rounded-lg p-4">
                    <summary className="font-medium text-gray-900 cursor-pointer">
                      Los webhooks no funcionan
                    </summary>
                    <div className="mt-3 text-sm text-gray-600 space-y-2">
                      <p>• Verifica que tu URL pública sea accesible</p>
                      <p>• Revisa la configuración de firewall</p>
                      <p>• Confirma el HMAC secret en Tiendanube</p>
                      <p>• Revisa los logs de errores en el panel</p>
                    </div>
                  </details>
                  
                  <details className="bg-gray-50 rounded-lg p-4">
                    <summary className="font-medium text-gray-900 cursor-pointer">
                      Problemas con Mercado Envíos
                    </summary>
                    <div className="mt-3 text-sm text-gray-600 space-y-2">
                      <p>• Verifica que los productos tengan dimensiones y peso</p>
                      <p>• Confirma que tu código postal esté cubierto</p>
                      <p>• Revisa la configuración de ME2 en ML</p>
                      <p>• Prueba con diferentes códigos postales</p>
                    </div>
                  </details>
                </div>
              </section>

              {/* Formulario de Contacto */}
              <section className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  ✉️ Enviar Mensaje de Soporte
                </h2>
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Asunto
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Problema de sincronización</option>
                      <option>Error en la aplicación</option>
                      <option>Consulta general</option>
                      <option>Solicitud de función</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensaje
                    </label>
                    <textarea 
                      rows={4} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe tu problema o consulta en detalle..."
                    ></textarea>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID de Tienda (opcional)
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: 1234567"
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200"
                  >
                    Enviar Mensaje
                  </button>
                </form>
              </section>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Horario de Atención */}
              <section className="bg-yellow-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-3">⏰ Horario de Atención</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>Lunes a Viernes:</strong></p>
                  <p>9:00 - 18:00 (ART)</p>
                  <p className="mt-2"><strong>Sábados y Domingos:</strong></p>
                  <p>Soporte limitado</p>
                  <p className="mt-2"><strong>Emergencias:</strong></p>
                  <p>soporte@technocat2.mitiendanube.com</p>
                </div>
              </section>

              {/* Recursos */}
              <section className="bg-green-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-3">📚 Recursos Útiles</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="/docs/guia-tienda-tiendanube.md" className="text-blue-600 hover:underline">
                      Guía de Instalación
                    </a>
                  </li>
                  <li>
                    <a href="/docs/checklist-tiendanube-produccion.md" className="text-blue-600 hover:underline">
                      Checklist de Producción
                    </a>
                  </li>
                  <li>
                    <a href="/configuracion" className="text-blue-600 hover:underline">
                      Configuración Inicial
                    </a>
                  </li>
                  <li>
                    <a href="https://developers.tiendanube.com" className="text-blue-600 hover:underline">
                      Documentación Tiendanube
                    </a>
                  </li>
                </ul>
              </section>

              {/* Estado del Sistema */}
              <section className="bg-gray-100 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-3">🟢 Estado del Sistema</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">API Tiendanube</span>
                    <span className="text-green-600 font-medium">Operativo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mercado Libre</span>
                    <span className="text-green-600 font-medium">Operativo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mercado Pago</span>
                    <span className="text-green-600 font-medium">Operativo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base de Datos</span>
                    <span className="text-green-600 font-medium">Operativo</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Última actualización: {new Date().toLocaleString('es-AR')}
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
