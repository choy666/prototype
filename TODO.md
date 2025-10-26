# Plan para Vincular Categorías en Edición de Productos

## Información Recopilada
- La página `app/admin/products/[id]/edit/page.tsx` tiene un select hardcodeado para categorías con opciones fijas.
- Existe una tabla `categories` en la base de datos con `id`, `name`, `description`.
- La tabla `products` tiene `categoryId` (referencia a categories.id) y `category` (string para compatibilidad).
- Hay API `/api/admin/categories` para obtener categorías.
- Las acciones en `lib/actions/categories.ts` incluyen `getCategories()`.
- El API de productos ya acepta `categoryId` en updates.

## Plan Detallado
1. **Modificar `app/admin/products/[id]/edit/page.tsx`**:
   - Agregar estado para almacenar la lista de categorías.
   - Agregar fetch de categorías en `useEffect`.
   - Cambiar `ProductForm` para incluir `categoryId` como string.
   - Actualizar el fetch del producto para incluir `categoryId`.
   - Modificar el select para usar categorías dinámicas.
   - Actualizar `handleSubmit` para enviar `categoryId` como number.

2. **Verificar compatibilidad en `lib/actions/products.ts`**:
   - Asegurar que `updateProduct` maneje `categoryId` correctamente.

## Archivos Dependientes
- `app/admin/products/[id]/edit/page.tsx` (principal)
- `lib/actions/products.ts` (si necesita ajustes menores)

## Pasos de Implementación
- [ ] Agregar import de tipos Category en page.tsx
- [ ] Agregar estado `categories` y `categoriesLoading`
- [ ] Agregar fetch de categorías en useEffect
- [ ] Cambiar ProductForm para incluir categoryId
- [ ] Actualizar setForm en fetchProduct para categoryId
- [ ] Modificar el select para mapear categorías
- [ ] Actualizar handleSubmit para enviar categoryId
- [ ] Probar la funcionalidad

## Pasos de Seguimiento
- [ ] Ejecutar `npm run dev` para probar localmente
- [ ] Verificar que las categorías se carguen correctamente
- [ ] Probar edición de producto con categoría seleccionada
- [ ] Verificar que se guarde categoryId en la base de datos
