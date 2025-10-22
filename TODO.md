# TODO: Análisis y Corrección del Sistema de Órdenes

## 📋 ANÁLISIS REALIZADO

### ✅ Componentes Analizados
- [x] `app/api/checkout/route.ts` - Crea preferencia de pago, NO crea orden
- [x] `app/api/webhooks/mercado-pago/route.ts` - Recibe eventos, NO procesa órdenes
- [x] `app/api/orders/route.ts` - Solo lee órdenes existentes
- [x] `lib/schema.ts` - Esquema correcto para orders y orderItems
- [x] `AUDITORIA_FASE_4_CHECKOUT_PAGOS.md` - Documenta problemas conocidos

### ❌ PROBLEMAS CRÍTICOS IDENTIFICADOS

1. **NO se crean órdenes después del checkout** 🔴
   - El checkout crea preferencia de pago pero NO guarda orden en BD
   - Campo `shippingAddress` no se utiliza

2. **Webhook no procesa pagos aprobados** 🔴
   - Solo loggea eventos, no actualiza/crea órdenes
   - No hay lógica para `payment.approved`

3. **Falta lógica de creación de órdenes** 🔴
   - No hay inserción en tablas `orders` y `orderItems`
   - Estados de orden no se actualizan

## 🎯 PLAN DE CORRECCIÓN

### Fase 1: Implementar Creación de Órdenes en Webhook
**Prioridad: CRÍTICA** 🔴

**Archivos a modificar:**
- [ ] `app/api/webhooks/mercado-pago/route.ts`
  - [ ] Agregar procesamiento de `payment.approved`
  - [ ] Crear orden con estado "paid"
  - [ ] Insertar items de la orden
  - [ ] Actualizar stock de productos
  - [ ] Usar metadata del pago para datos de envío

**Lógica requerida:**
```typescript
if (action === 'payment.updated' && data.status === 'approved') {
  // Crear orden en BD usando metadata del pago
  // Insertar orderItems
  // Actualizar stock
}
```

### Fase 2: Mejorar Checkout para Guardar Datos de Envío
**Prioridad: CRÍTICA** 🔴

**Archivos a modificar:**
- [ ] `app/api/checkout/route.ts`
  - [ ] Guardar shippingAddress en metadata del pago
  - [ ] Validar que shippingAddress esté presente
  - [ ] Incluir shippingCost en metadata

### Fase 3: Agregar Validaciones y Logging
**Prioridad: ALTA** 🟡

**Archivos a modificar:**
- [ ] `app/api/webhooks/mercado-pago/route.ts`
  - [ ] Validar firma del webhook (seguridad)
  - [ ] Evitar procesamiento duplicado
  - [ ] Logging detallado de errores
  - [ ] Manejo de reintentos

### Fase 4: Testing y Verificación
**Prioridad: MEDIA** 🟢

**Tareas:**
- [ ] Probar flujo completo: checkout → pago → webhook → orden creada
- [ ] Verificar que orden aparece en historial
- [ ] Verificar actualización de stock
- [ ] Verificar estados de orden

## 📊 ESTADO ACTUAL vs ESPERADO

| Componente | Estado Actual | Estado Esperado |
|------------|---------------|-----------------|
| Checkout | Crea preferencia ✅ | Crea preferencia + guarda datos envío ❌ |
| Webhook | Loggea eventos ✅ | Procesa pagos y crea órdenes ❌ |
| Órdenes | Solo lectura ✅ | Creación automática tras pago ❌ |
| Stock | No se actualiza ❌ | Se reduce tras pago aprobado ❌ |

## 🔄 FLUJO ACTUAL vs FLUJO CORREGIDO

### Flujo Actual (ROTO):
1. Usuario hace checkout → Se crea preferencia de pago
2. Usuario paga en MP → MP notifica webhook
3. Webhook recibe evento → Solo se loggea, NO se crea orden
4. Usuario ve confirmación → Pero NO hay orden en BD

### Flujo Corregido (FUNCIONAL):
1. Usuario hace checkout → Se crea preferencia con metadata completa
2. Usuario paga en MP → MP notifica webhook
3. Webhook procesa `payment.approved` → Crea orden con items en BD
4. Stock se actualiza → Estado de orden = "paid"
5. Usuario ve confirmación → Orden visible en historial

## 🛠️ IMPLEMENTACIÓN TÉCNICA

### 1. Modificar Webhook Handler
```typescript
// En app/api/webhooks/mercado-pago/route.ts
if (action === 'payment.updated') {
  const { status, metadata } = data;

  if (status === 'approved') {
    // Extraer datos de metadata
    const { userId, shippingAddress, shippingMethodId, items } = metadata;

    // Crear orden
    const order = await db.insert(orders).values({
      userId: parseInt(userId),
      total: calculateTotal(items),
      status: 'paid',
      paymentId: data.id,
      mercadoPagoId: data.id.toString(),
      shippingAddress: shippingAddress,
      shippingMethodId: parseInt(shippingMethodId),
      shippingCost: parseFloat(metadata.shippingCost),
    }).returning();

    // Crear orderItems
    for (const item of items) {
      await db.insert(orderItems).values({
        orderId: order[0].id,
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
      });

      // Actualizar stock
      await db.update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(eq(products.id, item.id));
    }
  }
}
```

### 2. Mejorar Checkout Metadata
```typescript
// En app/api/checkout/route.ts
metadata: {
  userId: userId,
  shippingAddress: JSON.stringify(shippingAddress),
  shippingMethodId: method.id.toString(),
  subtotal: subtotal.toString(),
  shippingCost: shippingCost.toString(),
  total: total.toString(),
  items: JSON.stringify(items), // Agregar items para webhook
},
```

## ✅ CRITERIOS DE ÉXITO

- [ ] Checkout guarda datos de envío en metadata
- [ ] Webhook crea orden tras pago aprobado
- [ ] Órdenes aparecen en historial del usuario
- [ ] Stock se reduce correctamente
- [ ] Estados de orden se actualizan
- [ ] Logging adecuado para debugging
- [ ] Manejo de errores robusto

## 📅 TIEMPO ESTIMADO

- **Fase 1 (Crítica):** 2-3 horas
- **Fase 2 (Crítica):** 1-2 horas
- **Fase 3 (Alta):** 1-2 horas
- **Fase 4 (Testing):** 2-3 horas
- **Total:** 6-10 horas

## 🚀 PRÓXIMOS PASOS

1. Aprobar este plan
2. Implementar Fase 1 (webhook)
3. Implementar Fase 2 (checkout metadata)
4. Testing completo
5. Deploy y verificación en producción
