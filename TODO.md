# TODO: Arreglar Creación de Órdenes en Webhook de MercadoPago

## Problema Identificado
- El webhook recibe eventos de MercadoPago pero no crea órdenes en la base de datos.
- Solo procesa 'payment.updated' pero el evento podría ser otro.
- Falta lógica para insertar la orden y items cuando el pago es aprobado.

## Pasos a Realizar
- [ ] Modificar `app/api/webhooks/mercadopago/route.ts` para procesar eventos correctos y crear órdenes.
- [ ] Agregar imports necesarios para base de datos y schemas.
- [ ] En `handlePaymentEvent`, extraer metadata del pago y crear orden si aprobado.
- [ ] Insertar orderItems basados en los items de metadata.
- [ ] Actualizar status de la orden a 'paid'.
- [ ] Probar el webhook con simulación.
- [ ] Verificar que las órdenes aparezcan en /api/orders.

## Archivos a Modificar
- app/api/webhooks/mercadopago/route.ts
- (Posiblemente checkout para asegurar metadata correcta)

## Notas
- Usar metadata de la preferencia para obtener userId, items, shipping, etc.
- Asegurar que payment.metadata esté disponible en el objeto payment.
