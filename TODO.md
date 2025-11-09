# TODO: Solucionar errores y advertencias de compilación

## Errores y Advertencias a Resolver

### Advertencias de variables no usadas
- [ ] Remover importación 'products' no usada en `app/api/admin/products/[id]/variants/route-new.ts`
- [ ] Remover importación 'products' no usada en `app/api/admin/products/[id]/variants/route.ts`
- [ ] Remover o usar variable 'selectedVariantName' en `app/products/[id]/ProductClient.tsx`
- [ ] Remover importación 'ImageIcon' no usada en `components/admin/ProductVariantsNew.tsx`
- [ ] Remover importación 'ImageReorder' no usada en `components/admin/ProductVariantsNew.tsx`

### Errores de entidades no escapadas
- [ ] Escapar comillas dobles en línea 452 de `components/admin/ProductVariantsNew.tsx`

## Pasos de Implementación
1. Editar `route-new.ts` para remover importación 'products'
2. Editar `route.ts` para remover importación 'products'
3. Editar `ProductClient.tsx` para remover o usar 'selectedVariantName'
4. Editar `ProductVariantsNew.tsx` para remover importaciones no usadas y escapar comillas
5. Verificar que la compilación pase sin errores
