# TODO: Corrección de Errores en Gestión de Stock

## Problemas Identificados
- Error "¡Ups! Algo salió mal" al intentar modificar stock en `/admin/products/[id]/stock`
- `userId` hardcodeado como `1` en funciones de ajuste de stock, causando errores de referencia de clave foránea
- Falta obtener `userId` dinámicamente del usuario autenticado
- En `/admin/products/[id]/edit`, la pestaña de variantes muestra stock pero permite edición (debe ser solo lectura)

## Tareas Pendientes

### 1. Corregir userId hardcodeado en stock/page.tsx
- [ ] Agregar import de `useSession` de `next-auth/react`
- [ ] Obtener `userId` de la sesión del usuario autenticado
- [ ] Reemplazar `userId: 1` con el `userId` dinámico en `handleProductStockUpdate` y `handleVariantStockUpdate`
- [ ] Manejar casos donde la sesión no esté disponible (fallback seguro)

### 2. Verificar permisos de edición de stock
- [ ] Confirmar que solo usuarios con rol 'admin' pueden acceder a la página de stock
- [ ] Asegurar que cualquier admin pueda modificar stock, no solo usuario ID 1

### 3. Corregir visualización en edit/page.tsx
- [ ] Verificar que en la pestaña "Variantes" solo se muestren valores de stock sin posibilidad de edición
- [ ] Confirmar que `stockReadOnly={true}` esté funcionando correctamente en `ProductVariants`

### 4. Testing y Validación
- [ ] Probar modificación de stock de producto principal
- [ ] Probar modificación de stock de variantes
- [ ] Verificar que los logs de stock se registren correctamente con el userId correcto
- [ ] Confirmar que no aparezca el error "¡Ups! Algo salió mal"

### 5. Mejoras Adicionales
- [ ] Agregar validación de sesión antes de permitir modificaciones
- [ ] Mejorar manejo de errores en caso de sesión expirada
- [ ] Considerar agregar confirmación antes de actualizar stock
