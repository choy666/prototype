# TODO: Quitar Estado de Variante en Edición de Producto

## Descripción
Implementar cambios para remover la lógica y contenido relacionado con el "Estado de una variante" en la pestaña de Variantes del archivo `./app/admin/products/[id]/edit/page.tsx`. La pestaña debe mostrar únicamente: Atributos, Precio, Stock y Acciones (editar/eliminar).

## Información Recopilada
- **Archivo principal**: `app/admin/products/[id]/edit/page.tsx` - Contiene la pestaña "variants" que renderiza `<ProductVariants productId={parseInt(id)} />`.
- **Componente de variantes**: `components/admin/ProductVariants.tsx` - Maneja la lógica completa de variantes, incluyendo estado (isActive), filtros, acciones masivas y UI.
- **Elementos a remover**:
  - Filtros por estado (Todas, Activas, Inactivas).
  - Columna "Estado" en la tabla de variantes.
  - Botón de toggle para activar/desactivar variantes individuales.
  - Funciones de acciones masivas: `bulkActivate` y `bulkDeactivate`.
  - Referencias al estado en la UI (mantener `isActive` en la interfaz si se usa en el backend).

## Plan de Implementación

### 1. Modificar `components/admin/ProductVariants.tsx`
- [ ] Remover filtros por estado (`filterStatus`, botones "Todas", "Activas", "Inactivas").
- [ ] Eliminar columna "Estado" de la tabla de variantes (grid-cols-12 a grid-cols-10).
- [ ] Remover función `toggleVariantStatus`.
- [ ] Remover funciones `bulkActivate` y `bulkDeactivate`.
- [ ] Remover botones de acciones masivas relacionados con activar/desactivar.
- [ ] Actualizar la interfaz de la tabla para reflejar las columnas restantes: Selección, Atributos, Precio, Stock, Acciones.
- [ ] Verificar que `isActive` se mantenga en `ProductVariant` si es necesario para el backend, pero no se muestre en UI.

### 2. Verificar `app/admin/products/[id]/edit/page.tsx`
- [ ] Confirmar que no hay lógica adicional de estado en este archivo.
- [ ] Asegurar que la pestaña "variants" siga renderizando correctamente el componente modificado.

### 3. Pruebas y Validación
- [ ] Probar que la pestaña de Variantes muestre solo Atributos, Precio, Stock y Acciones.
- [ ] Verificar que editar y eliminar variantes siga funcionando.
- [ ] Confirmar que no hay errores en la consola relacionados con elementos removidos.
- [ ] Probar la creación de nuevas variantes sin campos de estado.

## Archivos Dependientes
- `components/admin/ProductVariants.tsx` (modificación principal).
- `app/admin/products/[id]/edit/page.tsx` (verificación, posible ajuste menor en layout si es necesario).

## Pasos de Seguimiento
- Ejecutar `npm run dev` para probar en desarrollo.
- Verificar en el navegador que la UI se vea correcta sin elementos de estado.
- Si hay errores, revisar logs y ajustar código.
- Commit de cambios una vez probado.

## Notas Adicionales
- Mantener `isActive` en la interfaz `ProductVariant` si el backend lo requiere para operaciones de API.
- Asegurar que las acciones masivas restantes (eliminar) sigan funcionando correctamente.
- Si se detectan problemas con el layout de la tabla, ajustar clases CSS de grid.
