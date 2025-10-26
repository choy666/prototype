# TODO: Implementar uso de categoryId en productos

## Información Recopilada
- La tabla `categories` existe con `id` y `name`.
- La tabla `products` tiene `categoryId` (opcional) y `category` (string, para compatibilidad).
- Actualmente, el formulario de nuevo producto usa `category` como string hardcodeado.
- El API valida `category` como string, pero también tiene `categoryId` opcional.
- `createProduct` recibe `category` como string.

## Plan
- Modificar formulario de nuevo producto para cargar categorías dinámicamente y enviar `categoryId`.
- Actualizar validación en API para requerir `categoryId` y quitar `category`.
- Modificar `createProduct` para usar `categoryId` y poblar `category` con el nombre de la categoría.
- Actualizar formulario de editar producto similarmente.
- Verificar que funcione correctamente.

## Pasos a Completar
- [ ] Modificar `app/admin/products/new/page.tsx` para cargar categorías desde API y usar `categoryId`.
- [ ] Actualizar schema en `app/api/admin/products/route.ts` para validar `categoryId` requerido.
- [ ] Modificar `createProduct` en `lib/actions/products.ts` para usar `categoryId` y poblar `category`.
- [ ] Modificar `app/admin/products/[id]/edit/page.tsx` para usar `categoryId`.
- [ ] Actualizar `updateProduct` en `lib/actions/products.ts` si es necesario.
- [ ] Probar la funcionalidad.
