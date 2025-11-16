# Implementación del Campo isActive en Productos

## Estado: Completado

### Pasos Completados:
- [x] Paso 1: Actualizar el Schema (lib/schema.ts)
- [x] Paso 2: Crear Migración (npx drizzle-kit generate && npx drizzle-kit migrate)
- [x] Paso 3: Actualizar las Consultas de Productos (lib/actions/products.ts)
- [x] Paso 4: Actualizar la API de Productos (app/api/admin/products/route.ts)
- [x] Paso 5: Actualizar la Interfaz de Administración (app/admin/products/page.tsx)
- [x] Paso 6: Agregar Acción de "Desactivar/Reactivar" (funciones y botones)

### Próximos Pasos:
- Actualizar schema.ts para agregar isActive
- Generar y ejecutar migración
- Modificar consultas para filtrar productos activos
- Actualizar API para manejar filtros de admin vs tienda
- Agregar indicador de estado en la interfaz admin
- Cambiar botón eliminar por toggle active
- Agregar función para toggle active
