# Plan de Implementación de Pagos (Mercado Pago Checkout Pro)

Guía breve y práctica para implementar y mantener el flujo de pagos integrado con tus órdenes.

---

## 1. Objetivo

- **Conectar Checkout Pro de Mercado Pago** con:
  - Creación de órdenes locales.
  - Actualización de estado por webhooks.
  - Páginas de resultado (`success`, `pending`, `failure`).
- **Garantizar trazabilidad completa**: preferencia ⇄ pago ⇄ orden.

---

## 2. Flujo General (Resumen)

1. Usuario arma carrito y completa datos de envío.
2. Backend crea **orden local** (`orders`) con estado `pending`.
3. Backend crea **preferencia de Mercado Pago** con:
   - `external_reference = order.id` (o `order_${order.id}`).
   - `metadata.order_id = order.id`.
4. Frontend redirige a `init_point` (Checkout Pro).
5. Mercado Pago envía **webhooks de pago** → `/api/webhooks/mercadopago` → `/api/mercadopago/payments/notify`.
6. Webhook actualiza **`mercadopago_payments`** y **`orders.status`** según `payment.status`.
7. Páginas `/payment-success`, `/payment-pending`, `/payment-failure` consultan `/api/order-status` para mostrar el estado real de la orden.

---

## 3. Configuración de Entorno

### 3.1. Variables de entorno (desarrollo)

En `.env.local`:

- **URLs de app**
  - `NEXT_PUBLIC_APP_URL="http://localhost:3000"`
- **Mercado Pago**
  - `MERCADO_PAGO_ACCESS_TOKEN="TEST-..."`  *(usar token de prueba)*
  - `NEXT_PUBLIC_MP_PUBLIC_KEY="TEST-..."`
  - `MERCADO_PAGO_SUCCESS_URL="https://localhost:3000/payment-success"`
  - `MERCADO_PAGO_FAILURE_URL="https://localhost:3000/payment-failure"`
  - `MERCADO_PAGO_PENDING_URL="https://localhost:3000/payment-pending"`
  - `MERCADO_PAGO_NOTIFICATION_URL="https://localhost:3000/api/webhooks/mercadopago"`

### 3.2. Variables de entorno (producción)

En `.env.production` (ya configurado en el proyecto):

- `NEXT_PUBLIC_APP_URL="https://prototype-ten-dun.vercel.app"`
- `MERCADO_PAGO_ACCESS_TOKEN="APP_USR-..."`
- `MERCADO_PAGO_*_URL` apuntando al dominio público (success, failure, pending, webhook).

---

## 4. Backend – Creación de Orden + Preferencia

### 4.1. Orden local (`orders`)

- Al iniciar el checkout (antes de llamar a Mercado Pago):
  - Crear un registro en `orders` con:
    - `userId`, `email`.
    - `total` (subtotal + envío).
    - `status = 'pending'`.
    - `shippingAddress`, `shippingMethodId`, `shippingCost`.

> **Nota:** en el proyecto actual, puedes reutilizar la lógica presente en los endpoints de órdenes o crear una función helper `createOrderFromCheckout()`.

### 4.2. Preferencia de Mercado Pago

En `app/api/checkout/route.ts`:

1. **Calcular subtotal y envío** (ya se hace con ME2).
2. **Armar `metadata`** incluyendo:
   - `user_id`, `order_id`, `shipping_method_id`, `shipping_cost`, `total`.
3. **Crear preferencia** con el SDK v2:
   - `external_reference = order.id.toString()`.
   - `metadata.order_id = order.id`.
   - `items` = productos + ítem de envío.
   - `payer` = datos del usuario + documento + dirección.
   - `back_urls` y `notification_url` usando las env vars.
   - `auto_return = "approved"`.
4. **Guardar preferencia en DB** (`mercadopago_preferences`):
   - `preferenceId`, `externalReference`, `orderId`, `userId`, `initPoint`, `items`, `payer`, `paymentMethods`, `status = 'pending'`.
5. **Respuesta al frontend**:
   - `orderId`.
   - `preferenceId`.
   - `initPoint` (para redirección).

---

## 5. Backend – Webhook de Pagos

Ruta clave: `app/api/mercadopago/payments/notify/route.ts`.

### 5.1. Flujo del webhook

1. Recibir payload (tipo `payment`).
2. Llamar al SDK: `Payment.get({ id })` para obtener los datos completos (`paymentData`).
3. Insertar/actualizar `mercadopago_payments` con:
   - `paymentId`, `preferenceId`, `status`, `externalReference`, `amount`, `rawData`, etc.
4. Llamar a `processPayment(paymentData)`.

### 5.2. Mapeo estado de pago → estado de orden

En `processPayment` ya tienes handlers por estado. Recomendación:

- `approved` → `orders.status = 'paid'`.
- `pending` → dejar `orders.status = 'pending'` (solo log).
- `rejected` → `orders.status = 'rejected'`.
- `cancelled` → `orders.status = 'cancelled'`.
- `refunded` → `orders.status = 'returned'` (opcional: reintegrar stock).
- `charged_back` → `orders.status = 'failed'` o `returned` + alerta a admin.

La vinculación se hace por:

- `paymentData.external_reference` → `mercadopago_preferences.externalReference` → `orders.id`.

### 5.3. Puntos a revisar/mejorar

- Implementar lógica en `handleRefundedPayment` y `handleChargedBackPayment` (si aún no se usa).
- Opcional: marcar en `mercadopagoPreferences.status`:
  - `pending` → preferencia creada.
  - `active` → pago `approved`.
  - `expired` → preferencia vencida.

---

## 6. Frontend – Checkout + Páginas de Resultado

### 6.1. Checkout (`/checkout`)

- Ya lo tienes implementado:
  - Envía `items`, `shippingAddress`, `shippingMethod`, `userId` a `/api/checkout`.
  - Usa la respuesta `initPoint` para redirigir:
    ```ts
    const paymentUrl = data.paymentUrl || data.initPoint || data.init_point;
    window.location.href = paymentUrl;
    ```

### 6.2. Páginas `/payment-success`, `/payment-pending`, `/payment-failure`

Objetivo: **no confiar solo en la URL de MP**, sino en el estado real de la orden.

1. Al llegar a estas páginas, obtener el `orderId`:
   - Ideal: pasarlo en `metadata` y en el redirect, o guardarlo en session/localStorage antes de ir a MP.
2. Llamar a:
   ```ts
   GET /api/order-status?order_id={orderId}
   ```
3. Mostrar UI según `orders.status`:

   - `paid` → mensaje de éxito, resumen de orden.
   - `pending` / `processing` → mensaje de “Estamos procesando tu pago” + **polling** cada 3–5s a `/api/order-status`.
   - `rejected` → mensaje de rechazo + botón para intentar pagar de nuevo.
   - `cancelled` → mensaje de cancelación.
   - `returned` / `failed` → mensaje especial y enlace a soporte.

---

## 7. Checklist de Testing

### 7.1. Desarrollo (sandbox)

- [ ] Usar `MERCADO_PAGO_ACCESS_TOKEN` de prueba (`TEST-...`).
- [ ] Crear un pago `approved` → verificar que:
  - [ ] `/api/mercadopago/payments/notify` se llame (simular webhook si hace falta).
  - [ ] Se inserte un registro en `mercadopago_payments`.
  - [ ] `orders.status` pase a `paid`.
- [ ] Crear un pago `rejected` → `orders.status = 'rejected'`.
- [ ] Cancelar un pago → `orders.status = 'cancelled'`.
- [ ] Verificar que `/payment-success` y `/payment-failure` muestren el estado real consultando `/api/order-status`.

### 7.2. Producción

- [ ] Confirmar que `.env.production` tenga:
  - [ ] `MERCADO_PAGO_ACCESS_TOKEN` (APP_USR-...).
  - [ ] `NEXT_PUBLIC_APP_URL` con el dominio público.
  - [ ] `MERCADO_PAGO_*_URL` apuntando al mismo dominio.
- [ ] Hacer un pago real pequeño (o test controlado) y verificar:
  - [ ] Preferencia creada correctamente (`logs` y/o DB).
  - [ ] Webhook recibido y procesado.
  - [ ] `orders.status` actualizado.
  - [ ] Páginas de resultado muestran la información correcta.

---

## 8. Resumen Final

- **Backend**: crea orden + preferencia, guarda enlaces en DB y delega el estado final de pago al webhook.
- **Webhook**: único punto de verdad para sincronizar `payment.status` con `orders.status`.
- **Frontend**: redirige a `init_point` y, al volver, consulta `/api/order-status` para mostrar el resultado real.

Usando este plan como guía, puedes mantener la integración de pagos limpia, trazable y fácil de depurar tanto en sandbox como en producción.
