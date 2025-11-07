# TODO: Corrección de Errores en Gestión de Stock

## Problemas Identificados
- Error "¡Ups! Algo salió mal" al intentar modificar stock en `/admin/products/[id]/stock`
- Posible error de clave foránea en `stockLogs.userId` si `session.user.id` no es válido o usuario no existe
- Falta logging detallado en el ErrorBoundary para capturar errores específicos
- En `/admin/products/[id]/edit`, la pestaña de variantes muestra stock pero permite edición (debe ser solo lectura)

## Tareas Pendientes

### 1. Mejorar logging de errores
- [x] Agregar logging detallado en `ErrorBoundary` para capturar stack trace y contexto del error
- [x] Verificar configuración del logger para asegurar que los errores se muestren en consola de desarrollo
- [x] Agregar try-catch específicos en `handleProductStockUpdate` y `handleVariantStockUpdate` para logging granular

### 2. Validar session.user.id y existencia de usuario
- [x] Agregar validación en `stock/page.tsx` para verificar que `session.user.id` sea un número válido
- [x] Verificar que el usuario autenticado exista en la base de datos antes de operaciones de stock
- [x] Manejar casos donde la sesión esté expirada o inválida con redirección apropiada

### 3. Corregir posibles errores de base de datos
- [x] Verificar que `productId` y `variantId` sean válidos antes de llamadas a `adjustStock` y `adjustVariantStock`
- [x] Agregar validación de existencia de producto/variante antes de actualizar stock
- [x] Manejar errores de conexión a base de datos con mensajes de error apropiados

### 4. Corregir visualización en edit/page.tsx
- [x] Verificar que en la pestaña "Variantes" solo se muestren valores de stock sin posibilidad de edición
- [x] Confirmar que `stockReadOnly={true}` esté funcionando correctamente en `ProductVariants`

### 5. Testing y Validación
- [ ] Probar modificación de stock de producto principal con usuario válido
- [ ] Probar modificación de stock de variantes con usuario válido
- [ ] Verificar que los logs de stock se registren correctamente con el userId correcto
- [ ] Confirmar que no aparezca el error "¡Ups! Algo salió mal" después de correcciones

### 6. Mejoras Adicionales
- [ ] Agregar validación de sesión antes de permitir modificaciones
- [ ] Mejorar manejo de errores en caso de sesión expirada
- [ ] Considerar agregar confirmación antes de actualizar stock
- [ ] Implementar rollback de stock en caso de error durante la actualización
