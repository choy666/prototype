# TODO: Solución a errores de eliminación de productos

## Tareas completadas:
- [x] Modificar la función `deleteProduct` en `lib/actions/products.ts` para verificar si el producto tiene `order_items` asociados antes de intentar eliminarlo.
- [x] Si el producto tiene órdenes asociadas, devolver un error específico en lugar de permitir la eliminación.
- [x] Actualizar el handler DELETE en `app/api/admin/products/[id]/route.ts` para manejar el nuevo error y devolver un mensaje apropiado al cliente.

## Información recopilada:
- El esquema de la base de datos muestra que `order_items` tiene una clave foránea `productId` que referencia `products.id`.
- La función `deleteProduct` actual intenta eliminar directamente sin verificar dependencias.
- El error ocurre porque PostgreSQL impide la eliminación debido a la restricción de clave foránea.

## Plan de implementación completado:
1. Agregar una consulta en `deleteProduct` para contar los `order_items` asociados al producto.
2. Si hay órdenes asociadas, lanzar un error específico.
3. Modificar el handler DELETE para capturar este error y devolver un mensaje de error apropiado.
4. Probar la funcionalidad.

## Archivos modificados:
- `lib/actions/products.ts`: Modificar `deleteProduct` y agregar import de `orderItems`.
- `app/api/admin/products/[id]/route.ts`: Actualizar manejo de errores en DELETE.

## Próximos pasos:
- [ ] Probar la eliminación de productos con y sin órdenes asociadas para verificar que la solución funcione correctamente.
- [ ] Desplegar los cambios a Vercel para verificar que los errores en producción se resuelvan.
