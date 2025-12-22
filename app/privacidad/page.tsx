import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad - TechnoCat',
  description: 'Política de privacidad y tratamiento de datos personales de la aplicación TechnoCat',
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Política de Privacidad
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                1. Información que Recopilamos
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  TechnoCat, en su calidad de aplicación integrada con Tiendanube, 
                  recopila la siguiente información para proporcionar sus servicios:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Datos de la Tienda:</strong> ID de tienda, nombre, URL, 
                    información de contacto del vendedor
                  </li>
                  <li>
                    <strong>Datos de Productos:</strong> catálogo completo, precios, 
                    stock, imágenes, descripciones y SKUs
                  </li>
                  <li>
                    <strong>Datos de Órdenes:</strong> información de ventas, 
                    estado de pagos, datos de envío
                  </li>
                  <li>
                    <strong>Datos de Clientes:</strong> nombre, email, teléfono, 
                    dirección de envío (sincronizados desde Tiendanube)
                  </li>
                  <li>
                    <strong>Datos de Uso:</strong> logs de actividad, métricas de 
                    rendimiento, errores del sistema
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                2. Finalidad del Tratamiento
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  Utilizamos la información recopilada para:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Sincronizar productos entre plataformas</li>
                  <li>Procesar órdenes y pagos de manera segura</li>
                  <li>Calcular costos de envío con Mercado Envíos</li>
                  <li>Proporcionar soporte técnico</li>
                  <li>Mejorar la calidad del servicio</li>
                  <li>Cumplir con obligaciones legales</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                3. Base Legal del Tratamiento
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  El tratamiento de datos se basa en:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Consentimiento:</strong> El usuario acepta al instalar 
                    la aplicación
                  </li>
                  <li>
                    <strong>Ejecución de Contrato:</strong> Para proveer los servicios 
                    contratados
                  </li>
                  <li>
                    <strong>Obligación Legal:</strong> Cumplimiento de normativas 
                    fiscales y comerciales
                  </li>
                  <li>
                    <strong>Interés Legítimo:</strong> Para seguridad y mejora del 
                    servicio
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                4. Conservación de Datos
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  Los datos se conservarán durante el tiempo necesario para:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Prestar los servicios solicitados</li>
                  <li>Cumplir con obligaciones legales</li>
                  <li>Resolver disputas y reclamos</li>
                  <li>Una vez finalizado el servicio, los datos se eliminarán 
                    de forma segura</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                5. Derechos del Usuario
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  Como titular de los datos, usted tiene derecho a:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Acceder a sus datos personales</li>
                  <li>Rectificar datos inexactos</li>
                  <li>Suprimir sus datos (derecho al olvido)</li>
                  <li>Limitar el tratamiento</li>
                  <li>Portabilidad de los datos</li>
                  <li>Oponerse al tratamiento</li>
                </ul>
                <p>
                  Para ejercer estos derechos, contacte a: 
                  <a href="mailto:privacidad@technocat2.mitiendanube.com" className="text-blue-600 hover:underline ml-1">
                    privacidad@technocat2.mitiendanube.com
                  </a>
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                6. Seguridad de los Datos
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  Implementamos medidas de seguridad adecuadas:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Encriptación SSL/TLS en todas las transmisiones</li>
                  <li>Base de datos cifrada y accesos restringidos</li>
                  <li>Autenticación de dos factores disponible</li>
                  <li>Auditoría periódica de seguridad</li>
                  <li>Cumplimiento con estándares ISO 27001</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                7. Transferencias Internacionales
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  Los datos pueden ser transferidos a:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Servidores de Mercado Libre (Argentina/Brasil)</li>
                  <li>Proveedores de cloud (AWS/Vercel)</li>
                  <li>Servicios de pago (Mercado Pago)</li>
                </ul>
                <p>
                  Todas las transferencias cumplen con las garantías adecuadas 
                  según la normativa vigente.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                8. Cookies y Tecnologías Similares
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  Utilizamos cookies para:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Mantener la sesión del usuario</li>
                  <li>Recordar preferencias</li>
                  <li>Analizar el uso del servicio</li>
                  <li>Mejorar la experiencia del usuario</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                9. Contacto y Autoridad de Control
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  <strong>Responsable del Tratamiento:</strong><br />
                  TechnoCat Integration<br />
                  Email: privacidad@technocat2.mitiendanube.com
                </p>
                <p>
                  <strong>Delegado de Protección de Datos (DPD):</strong><br />
                  Email: dpd@technocat2.mitiendanube.com
                </p>
                <p>
                  Para reclamaciones, puede contactar a la autoridad de 
                  protección de datos de su país.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                10. Actualizaciones de la Política
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  Esta política puede ser actualizada para reflejar cambios en 
                  nuestras prácticas o por requerimientos legales. Las 
                  modificaciones serán notificadas a los usuarios.
                </p>
                <p>
                  <strong>Última actualización:</strong> 21 de diciembre de 2024
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
