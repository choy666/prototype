# TODO - Verificaciones y Mejoras en Sistema de Órdenes

## 4. Verificaciones y Mejoras

### [ ] Verificar el Número de Seguimiento en el panel administrativo al guardar el cambio y corroborar su actualización en su respectivo pedido en el panel de usuario cuando entre a sus pedidos.
- [ ] Agregar validación de formato para trackingNumber:
Ejemplo:
  "Correo Argentino": /^[A-Z]{2}[0-9]{9}AR$/,
  "OCA": /^[0-9]{8,14}$/,
  "Andreani": /^[0-9]{12,16}$/,
  "Vía Cargo": /^[0-9]{8,12}$/,
  "Mercado Libre": /^ML[A-Z]{1}[0-9]{9}$/,
- [ ] Mejorar feedback visual al guardar cambios en admin
- [ ] Verificar que el trackingNumber se actualice correctamente en la base de datos
- [ ] Confirmar que se refleje en el panel de usuario (OrderTimeline)

### [ ] Agregar confirmaciones para las acciones correspondientes
- [ ] Implementar ConfirmationDialog en app/admin/orders/[id]/page.tsx antes de guardar cambios
- [ ] Mostrar resumen de cambios en el diálogo de confirmación
- [ ] Permitir cancelar la acción

### [ ] Implementar manejo de errores mejorado
- [ ] Mejorar mensajes de error específicos en app/api/admin/orders/[id]/route.ts
- [ ] Agregar logging detallado para operaciones de actualización
- [ ] Mejorar manejo de errores en el frontend (app/admin/orders/[id]/page.tsx)
- [ ] Agregar retry logic o mejor feedback para errores de red
