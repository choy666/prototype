# TODO - Actualización de Página de Orden Detallada

## Completado ✅
- [x] Crear nueva ruta API `/api/orders/[id]` para obtener orden específica con items
- [x] Actualizar frontend para usar la nueva API única
- [x] Mejorar manejo de errores con mensajes más específicos
- [x] Simplificar lógica de fetching eliminando doble llamada API

## Pendiente ⏳
- [ ] Probar la nueva API y verificar funcionamiento
- [ ] Verificar que la página funcione sin errores
- [ ] Agregar mejoras visuales menores si es necesario

## Notas
- Se eliminó la llamada ineficiente a `/api/order-status` y `/api/orders`
- Ahora se usa una sola llamada a `/api/orders/[id]`
- Mejor manejo de errores con mensajes específicos para cada código de estado
- Se agregó manejo de errores de conexión de red
