# TODO: Actualizar proyecto para usar solo lógica de status (estado logístico) y quitar paymentStatus de reportes y webhooks

## Archivos a modificar:
- [x] app/api/admin/reports/sales/route.ts: Cambiar condición de paymentStatus = 'paid' a status IN ['paid', 'shipped', 'delivered']
- [x] app/admin/page-new.tsx: Mantener status IN ['paid', 'shipped', 'delivered'] para pedidos, cambiar ingresos de paymentStatus = 'paid' a status IN ['paid', 'shipped', 'delivered']
- [x] app/api/admin/reports/products/route.ts: Cambiar condición de paymentStatus = 'paid' a status IN ['paid', 'shipped', 'delivered']
- [x] app/api/admin/reports/users/route.ts: Cambiar condición de paymentStatus = 'paid' a status IN ['paid', 'shipped', 'delivered']

## Pasos de implementación:
1. Modificar route.ts de sales para usar status logístico en lugar de paymentStatus
2. Actualizar dashboard (page-new.tsx) para usar status IN ['paid', 'shipped', 'delivered'] tanto para pedidos como ingresos
3. Cambiar reporte de productos para usar status IN ['paid', 'shipped', 'delivered']
4. Cambiar reporte de usuarios para usar status IN ['paid', 'shipped', 'delivered']
5. Verificar que paymentStatus sea remplazada por status donde sea necesario (webhooks para crear órdenes, checkout no lo usa)
6. Actualizar base de datos, quitanto paymentStatus

## Fin:
- [x] Todos los pasos de implementación fueron completados.
