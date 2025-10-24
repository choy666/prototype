# TODO: Solucionar Warnings y Errores en Build de Next.js

## Archivos a Modificar

### app/admin/products/page.tsx
- [ ] Remover import 'Archive' no utilizado (línea 17)
- [ ] Remover variable 'error' no utilizada en catch (línea 63)
- [ ] Agregar 'fetchProducts' al array de dependencias de useEffect (línea 76)
- [ ] Remover variable 'error' no utilizada en catch (línea 98)
- [ ] Reemplazar `<img>` con `<Image>` de next/image (línea 177)

### app/admin/products/[id]/edit/page.tsx
- [ ] Remover variable 'error' no utilizada en catch (línea 80)

### app/api/admin/products/route.ts
- [ ] Reemplazar 'any' en línea 38 con tipo específico
- [ ] Reemplazar 'any' en línea 39 con tipo específico

## Verificación
- [ ] Ejecutar `npm run build` para confirmar que no hay warnings ni errores
