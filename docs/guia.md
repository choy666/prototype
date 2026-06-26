🚀 Guía Paso a Paso para el E-commerce
 🛠️ Fase 1: Configuración Inicial
 🔧 Estructura Base:
 
 Estado general del proyecto (resumen rápido)
 - Base técnica implementada con Next.js 15.5, TypeScript, Tailwind 4.1, Drizzle ORM y Neon.
 - Autenticación funcional (NextAuth v5, login tradicional + OAuth Mercado Libre).
 - Integración con Mercado Pago y Mercado Envíos disponible.
 - Panel de usuario, catálogo, carrito y checkout operativos.
 - Integración Mercado Libre funcional (productos, órdenes y webhooks).
 
 Leyenda de estado
 - ✅ Completado / en uso
 - ⚙️ En progreso / refinando
 - ⏳ Planificado / pendiente
 
 ### Fase 1 – Configuración Inicial
 - ✅ Configuración de proyecto Next.js 15.5 + TypeScript.
 - ✅ Tailwind CSS 4.1 integrado y configurado.
 - ✅ ESLint + Prettier activos con reglas para TypeScript/React.
 - ✅ Drizzle ORM + Neon Postgres configurados y en uso.
 - ✅ Sistema de autenticación con NextAuth v5 (incluye OAuth Mercado Libre).
 
 ### Fase 2 – Catálogo de Productos
 - ✅ Modelo de datos de productos y categorías en Drizzle.
 - ✅ Listado de productos con filtros y búsqueda.
 - ✅ Páginas de detalle de producto.
 - ✅ Integración con Mercado Libre para sincronizar catálogo.
 - ⏳ Mejoras futuras y optimizaciones de consultas (ver roadmap en el README).
 
 ### Fase 3 – Carrito de Compras
 - ✅ Estado global del carrito (Zustand).
 - ✅ Persistencia local del carrito.
 - ✅ Mini-carrito y página completa de carrito.
 - ✅ Resumen de compra integrado con el flujo de checkout.
 
 ### Fase 4 – Checkout y Pagos
 - ✅ Flujo de checkout completo (carrito → dirección → pago MP → confirmación).
 - ✅ Integración con Mercado Pago (preferencias, pagos y registro en BD).
 - ✅ Manejo de órdenes asociado al flujo de pago.
 - ⚙️ Pendiente aumentar cobertura de tests de integración (ver sección Testing del README).
 
 ### Fase 5 – Panel de Usuario y Administración
 - ✅ Panel de usuario: perfil, direcciones, historial de pedidos.
 - ✅ Panel administrativo: gestión de productos, categorías y configuración Mercado Libre.
 - ✅ Integración con APIs de Mercado Libre para importación de órdenes y manejo de webhooks.
 - ⏳ Dashboard de métricas en tiempo real (marcado como futura mejora en el roadmap).
 
 ### Fase 6 – Optimización y Despliegue
 - ⚙️ Optimización de performance con métricas actuales altas (ver sección Performance del README).
 - ⏳ Monitoreo avanzado y métricas de integración (ver Roadmap y limitaciones actuales).
 - ✅ Despliegue recomendado con Vercel usando variables de entorno sincronizadas.
 - ✅ Scripts disponibles para validar entorno, auditar productos y analizar el tamaño de la build.
 
 Para más detalle técnico de cada fase y decisiones de diseño, revisar `README.md` y los documentos complementarios en `docs/`.
 Vercel: configuración y variables de entorno
 CI/CD automatizado
 fin.

 