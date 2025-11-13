# TODO: Arreglar sincronización del carrito entre localStorage y base de datos

## Problema identificado
Cuando el usuario navega desde /orders a /cart, aparecen productos antiguos en el carrito porque:
1. El carrito local (localStorage) se limpia correctamente después de un pago exitoso
2. Pero el carrito en la base de datos (usado para checkout) NO se limpia
3. Al ir a /cart, el código sincroniza fusionando items del servidor con los locales vacíos

## Solución requerida
Limpiar el carrito del usuario en la base de datos después de un checkout exitoso en el webhook de MercadoPago.

## Pasos a implementar
- [ ] Modificar `app/api/webhooks/mercadopago/route.ts` para llamar a `clearCart(userId)` después de crear una orden exitosa
- [ ] Verificar que no se limpien carritos de pagos rechazados
- [ ] Probar el flujo completo: agregar items -> checkout -> pago exitoso -> verificar que carrito esté vacío en BD y localStorage
