# Mejora: Sincronizar categoría en productos al editar

## Descripción
Implementar lógica en `updateProduct` para que al modificar `categoryId`, se actualice automáticamente el campo `category` con el nombre correspondiente de la categoría en la base de datos.

## Pasos a completar
- [ ] Modificar la función `updateProduct` en `lib/actions/products.ts` para sincronizar `category` cuando se actualiza `categoryId`
- [ ] Verificar que la categoría existe antes de actualizar
- [ ] Probar la funcionalidad editando un producto desde la interfaz de admin

## Archivos a modificar
- `lib/actions/products.ts`: Función `updateProduct`
