# TODO: Implementación de Cancelación de Pedidos

## Estado: Pendiente

### Descripción
Agregar funcionalidad completa de cancelación de pedidos con justificación obligatoria, actualización de estado, y notificaciones automáticas al administrador.

### Requisitos
- Opción "Cancelar Pedido" en vista app/orders/[id] para usuarios
- Campo obligatorio de justificación en modal
- Actualización automática del estado a "Cancelado"
- Notificación automática al administrador con detalles completos
- Panel de administrador con eventos destacados y enlace a detalles del pedido

### Pasos de Implementación

#### 1. Base de Datos y Schema
- [x] Agregar tabla `notifications` en `lib/schema.ts` para notificaciones de admin
- [x] Ejecutar migración de base de datos para nueva tabla

#### 2. Funcionalidad de Cancelación (Usuario)
- [x] Agregar botón "Cancelar Pedido" en `app/(protected)/orders/[id]/page.tsx`
  - Solo mostrar si estado permite cancelación (pending, paid)
  - Modal con textarea obligatorio para justificación
- [x] Crear endpoint API `app/api/orders/[id]/cancel/route.ts` (POST)
  - Validar autenticación y permisos
  - Actualizar estado a 'cancelled'
  - Guardar justificación
  - Crear notificación para admin
- [x] Agregar función `cancelOrder` en `lib/actions/orders.ts`

#### 3. Notificaciones en Panel Admin
- [ ] Agregar sección de notificaciones en `app/admin/page.tsx`
  - Mostrar notificaciones recientes como eventos destacados
  - Enlace directo a detalles del pedido
- [x] Crear endpoint API para obtener notificaciones `app/api/admin/notifications/route.ts`

#### 4. Detalles en Vista Admin
- [ ] Mostrar justificación de cancelación en `app/admin/orders/[id]/page.tsx`
  - Campo adicional cuando estado es 'cancelled'


### Archivos a Modificar
- `lib/schema.ts` - Nueva tabla notifications
- `app/(protected)/orders/[id]/page.tsx` - Botón cancelar y modal
- `app/api/orders/[id]/cancel/route.ts` - Nuevo endpoint
- `lib/actions/orders.ts` - Función cancelOrder
- `app/admin/page.tsx` - Sección notificaciones
- `app/admin/orders/[id]/page.tsx` - Mostrar justificación
- `app/api/admin/notifications/route.ts` - Nuevo endpoint para notificaciones

### Notas Técnicas
- Usar transacciones para asegurar atomicidad en cancelación
- Logging apropiado para auditoría
- Rate limiting en endpoints sensibles
- Validación de permisos tanto en cliente como servidor
