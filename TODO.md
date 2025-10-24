# Implementar Recomendaciones de Checkout y Webhook

## Tareas Completadas

### 1. Forzar tipado en el checkout
- [x] Verificar que userId se envíe siempre como string en metadata (ya implementado en checkout/route.ts)

### 2. Loggear antes de enviar a MercadoPago
- [x] Agregar console.log("Metadata enviada a MP:", metadata) justo antes de crear la preferencia en app/api/checkout/route.ts

### 3. Validación en el webhook
- [x] Asegurar que si userId no existe o no es string, se loggee el valor crudo y se aborte la creación de orden en app/api/webhooks/mercadopago/route.ts

## Archivos modificados
- app/api/checkout/route.ts
- app/api/webhooks/mercadopago/route.ts

## Próximos pasos
- Probar los cambios con scripts de testing
- Verificar logs en producción
