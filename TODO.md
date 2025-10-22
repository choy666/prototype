# Plan de Solución: Error al Obtener Órdenes en Producción

## Problema
- Error de PostgreSQL al ejecutar consulta en `/api/orders`.
- Logger sanitiza excesivamente, ocultando detalles del error.
- Posibles causas: userId inválido, conexión DB, tabla inexistente.

## Tareas Pendientes

### 1. Agregar Logging Detallado en `/api/orders`
- [ ] Loggear `session.user.id` antes de `parseInt`.
- [ ] Agregar validación: verificar que `parseInt(session.user.id)` sea un número válido.
- [ ] Usar `console.error` para el error completo (sin sanitizar) en producción para diagnóstico.

### 2. Modificar Logger para Errores de DB
- [ ] Actualizar `lib/utils/logger.ts` para no sanitizar objetos de error en `logger.error`.
- [ ] Permitir loggear `error.message` y `error.code` sin redacción.

### 3. Agregar Try-Catch Granular
- [ ] Envolver la consulta `userOrders` en try-catch separado.
- [ ] Envolver el `Promise.all` en try-catch separado.
- [ ] Loggear errores específicos para cada parte.

### 4. Verificar Base de Datos
- [ ] Ejecutar script para verificar conexión: `checkDatabaseConnection()`.
- [ ] Revisar migrations: asegurar que tabla `orders` existe.
- [ ] Verificar estructura de tabla en producción.

### 5. Validación de Datos
- [ ] Agregar check: si `parseInt(session.user.id)` es NaN, retornar 400.
- [ ] Verificar que el usuario existe en tabla `users`.

### 6. Pruebas y Despliegue
- [ ] Probar en desarrollo con datos similares.
- [ ] Desplegar cambios y monitorear logs.
- [ ] Si persiste, revisar configuración de Neon.

## Archivos a Modificar
- `app/api/orders/route.ts`
- `lib/utils/logger.ts`
- `lib/db.ts` (agregar función de verificación)

## Seguimiento
- Actualizar este TODO a medida que se completen tareas.
