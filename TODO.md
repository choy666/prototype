# Plan de Solución: Evitar ErrorBoundary en Dashboard al Ver Pedidos

## Información Recopilada
- Error "TypeError: r.map is not a function" ocurre en la página de pedidos porque la API puede devolver un objeto de error en lugar de un array de órdenes.
- La página no valida la respuesta de la API, causando que `orders` sea asignado con un objeto, provocando el error en el render.
- El ErrorBoundary global captura el error y muestra el fallback, impidiendo ver los pedidos.

## Plan de Implementación
- [x] Modificar `app/(protected)/orders/page.tsx` para mejorar el manejo de errores en el fetch de órdenes.
- [x] Agregar validación de respuesta HTTP y tipo de datos antes de asignar a `orders`.
- [x] Mostrar mensaje de error al usuario en caso de fallo en lugar de dejar estado inconsistente.

## Archivos Dependientes
- `app/(protected)/orders/page.tsx`: Archivo principal a modificar.

## Pasos de Seguimiento
- [ ] Probar la página de pedidos después de los cambios.
- [ ] Verificar que el ErrorBoundary global no se active al cargar pedidos.
- [ ] Confirmar que los errores se manejan correctamente mostrando mensajes al usuario.
