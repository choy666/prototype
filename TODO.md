# TODO: Soluciones a problemas de compilación

## Problemas identificados:
1. **Error de tipo en app/checkout/page.tsx:148** - `CartItem` no tiene propiedad `weight`
2. **Warning ESLint en ShippingMethodSelector.tsx:6** - `Button` importado pero no usado

## Plan de solución:
1. Agregar propiedad `weight` al tipo `CartItem` en `lib/stores/useCartStore.ts`
2. Remover importación no usada de `Button` en `components/checkout/ShippingMethodSelector.tsx`
3. Verificar que la compilación pase correctamente

## Pasos a seguir:
- [ ] Actualizar tipo `CartItem` para incluir `weight?: number | null`
- [ ] Remover importación `Button` de `ShippingMethodSelector.tsx`
- [ ] Ejecutar `npm run build` para verificar corrección
