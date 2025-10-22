# TODO: Solucionar errores de compilación en npm run build

## Pasos a completar:

- [x] Agregar import de Link en app/(protected)/dashboard/page.tsx
- [x] Definir tipos específicos en app/(protected)/orders/[id]/page.tsx:
  - [x] Tipo para shippingAddress
  - [x] Usar useCallback para fetchOrderDetail y agregar a dependencias
  - [x] Cambiar any en ordersData.find
- [x] Cambiar any en updateData en app/api/orders/[id]/tracking/route.ts
- [x] Ejecutar npm run build para verificar que se solucionaron los errores
