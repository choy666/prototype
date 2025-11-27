Voy a armar un documento en formato Markdown llamado `m2envios.md` con un plan de implementación paso a paso, de forma que puedas leerlo en un solo mensaje y aplicarlo directamente. No voy a crear el archivo en el repo a menos que luego me lo pidas explícitamente; por ahora te entrego el contenido listo para copiar.



A continuación tienes el contenido listo para `m2envios.md` para copiar/pegar en tu repo.

---

# Plan de implementación Mercado Envíos 2 (ME2)

## 1. Objetivos

- **Integrar correctamente ME2** según buenas prácticas de Mercado Libre.
- **Unificar cálculo de envíos** (ML + fallback local) y evitar errores como:
  - “No hay métodos de envío disponibles para este código postal”.
  - Logs de `Error calculating ML shipping cost`.
- **Alinear frontend y backend**:
  - Usuario final: selección clara de métodos ME2 y costos correctos.
  - Admin: configuración centralizada de modos, umbrales y fallback.
- **Cerrar el ciclo con Mercado Pago**:
  - Preferencia con costo de envío correcto.
  - Creación y tracking de shipments ML post-pago.

---

## 2. Fase 0 – Prerrequisitos en la cuenta de Mercado Libre

1. **Verificar preferencias de envío del vendedor**
   - **Acción**: llamar a `GET /users/{USER_ID}/shipping_preferences`.
   - **Objetivo**:
     - Confirmar que `modes` incluya `"me2"`.
     - Ver tipos y servicios permitidos en `logistics`:
       - `mode: "me2"`, `types: ["drop_off", "xd_drop_off", "cross_docking", ...]`.

2. **Verificar publicaciones de productos**
   - **Acción**: revisar ítems ML relevantes (los que usas en tu tienda).
   - **Checks**:
     - `shipping.mode = "me2"`.
     - `shipping.free_shipping` y `free_methods` configurados si aplica.
     - Atributos obligatorios del dominio + dimensiones (peso, alto, ancho, largo).

3. **(Opcional pero recomendado) Revisar reglas de envío gratis en ML**
   - **Acción**: revisar `free_configurations` en `shipping_preferences`.
   - **Objetivo**: saber qué reglas globales de envío gratis ya maneja ML para no duplicarlas mal en tu lógica local.

---

## 3. Fase 1 – Capa core de cálculo de envíos (backend)

### 3.1. Consolidar función core para ME2

- **Archivo base**: [lib/actions/me2-shipping.ts](cci:7://file:///c:/developer%20web/paginas/prototype/lib/actions/me2-shipping.ts:0:0-0:0).

- **Paso 1** – Adoptar [calculateME2ShippingCost](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/me2-shipping.ts:115:0-250:1) como fuente principal:
  - **Responsabilidades**:
    - Obtener dimensiones reales de productos desde BD.
    - Llamar a `POST /shipping_options/{item_id}` con:
      - `zipcode`, `item_id`, `quantity`, `dimensions`, `local_pickup: false`, `logistic_type: 'me2'`.
    - Manejar errores con reintentos (`retryWithBackoff`).
    - Aplicar fallback local con umbrales de envío gratis por provincia ([calculateFallbackShipping](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/me2-shipping.ts:252:0-293:1)).

- **Paso 2** – Crear un modelo interno unificado de método de envío:
  - **Definir tipo** (ej. en `lib/types/shipping.ts`):

    - **Campos mínimos**:
      - `id`, `name`, `description?`
      - `cost`, `currencyId`
      - `estimatedDelivery { date, timeFrom?, timeTo? }`
      - `shippingMode`, `logisticType`
      - `freeShipping: boolean`
      - `freeShippingThreshold?: number`

  - **Implementar mapeos**:
    - Respuesta de ML (`methods`) → tipo interno.
    - Fallback local → mismo tipo interno.

### 3.2. Sustituir usos directos de [calculateMLShippingCost](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/shipments.ts:15:0-114:1)

- **Archivos a revisar**:
  - [lib/actions/shipments.ts](cci:7://file:///c:/developer%20web/paginas/prototype/lib/actions/shipments.ts:0:0-0:0) ([calculateMLShippingCost](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/shipments.ts:15:0-114:1) actual).
  - [app/api/shipments/calculate/route.ts](cci:7://file:///c:/developer%20web/paginas/prototype/app/api/shipments/calculate/route.ts:0:0-0:0).
  - [app/api/admin/test-shipping/route.ts](cci:7://file:///c:/developer%20web/paginas/prototype/app/api/admin/test-shipping/route.ts:0:0-0:0).
  - [app/api/checkout/route.ts](cci:7://file:///c:/developer%20web/paginas/prototype/app/api/checkout/route.ts:0:0-0:0).

- **Acción**:
  - Donde hoy se llama [calculateMLShippingCost](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/shipments.ts:15:0-114:1), reemplazar por una función nueva, por ejemplo:
    - `getShippingOptionsForCart(zipcode, items)` → devuelve `{ methods, coverage, fallback }` usando ME2 + fallback local.

---

## 4. Fase 2 – Endpoint oficial de cálculo de envíos

### 4.1. `/api/shipments/calculate` como fuente única para el frontend

- **Archivo**: [app/api/shipments/calculate/route.ts](cci:7://file:///c:/developer%20web/paginas/prototype/app/api/shipments/calculate/route.ts:0:0-0:0).

- **Paso 1** – Usar la capa core
  - Reemplazar la llamada directa a [calculateMLShippingCost](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/shipments.ts:15:0-114:1) por la nueva función core:
    - `const { methods, coverage, fallback } = await getShippingOptionsForCart(zipcode, items)`.

- **Paso 2** – Ajustar la respuesta JSON
  - **Estandarizar** a tu tipo interno:
    - `methods: ShippingMethodInterno[]`.
    - `coverage: { covered: boolean; details? }`.
    - `fallback?: boolean`.
    - `message?: string`.

- **Paso 3** – Mejorar manejo de errores y fallback
  - En el `catch`:
    - Loggear siempre `message`, `status`, `requestBody`.
    - **Regla**:
      - Si el error es validación Zod → devolver 400 con detalles.
      - Cualquier error de ML / red:
        - Intentar fallback local ([calculateFallbackShipping](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/me2-shipping.ts:252:0-293:1) o similar).
        - Si fallback tiene métodos:
          - Devolver 200 `{ success: true, fallback: true, methods: [...], message: 'Usando métodos locales' }`.
        - Sólo si todo falla:
          - Devolver 500 `{ error: 'Error al calcular costo de envío' }`.

---

## 5. Fase 3 – Checkout backend (Mercado Pago + ML)

### 5.1. Reutilizar lógica de envíos en `/api/checkout`

- **Archivo**: [app/api/checkout/route.ts](cci:7://file:///c:/developer%20web/paginas/prototype/app/api/checkout/route.ts:0:0-0:0).

- **Paso 1** – Obtener costo de envío de forma coherente
  - Opciones:
    - **Opción A (sencilla)**: recalcular internamente con `getShippingOptionsForCart(zipcode, items)` y tomar el método por `id` elegido por el usuario.
    - **Opción B**: confiar en el frontend pero validar costo:
      - Recibir `shippingMethod` completo del front (id, cost, etc.).
      - Recalcular o al menos verificar que el método existe y el costo no es obviamente inválido.

- **Paso 2** – Construir la preferencia de Mercado Pago
  - Usar `shippingCost` ya validado:
    - Agregar ítem de “Envío - {nombre}” sólo si `shippingCost > 0`.
  - En `shipments` (MP):
    - `mode: "me2"`.
    - `receiver_address` desde `shippingAddress` del checkout.
    - `dimensions`: usar un valor más fino en el futuro (se puede conectar a dimensiones reales ya calculadas).

- **Paso 3** – Metadata y orden local
  - En `metadata` de MP:
    - `shippingMethodId`, `shippingCost`, `shippingMode`, `logisticType`.
  - Guardar orden local con esos datos para crear shipment ML después del pago.

### 5.2. Webhook MP + creación de shipment ML

- **Endpoints**: `app/api/mercadopago/webhook` y helpers.

- **Pasos**:
  - Al recibir pago aprobado:
    - Confirmar que la orden local existe o crearla si no.
    - Invocar [createMLShipment(orderId)](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/shipments.ts:116:0-255:1) (ya existe en [lib/actions/shipments.ts](cci:7://file:///c:/developer%20web/paginas/prototype/lib/actions/shipments.ts:0:0-0:0)).
    - Guardar `mercadoLibreShipmentId`, `trackingNumber`, `trackingUrl`.
  - Usar [getMLShipmentTracking](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/shipments.ts:257:0-310:1) / [syncPendingShipments](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/shipments.ts:312:0-349:1) para mantener estado `shippingStatus`.

---

## 6. Fase 4 – Frontend (usuario final)

### 6.1. Selector de métodos de envío

- **Archivo**: `components/checkout/ShippingMethodSelector.tsx`.

- **Paso 1** – Consumir el modelo interno
  - Ajustar parseo de la respuesta de `/api/shipments/calculate` a tu tipo interno.
  - Mostrar:
    - Nombre del método.
    - Costo (o “Gratis” si `cost === 0`).
    - Descripción y fecha estimada.

- **Paso 2** – Manejar estados y errores
  - Cuando `shippingMethods.length === 0`:
    - Si `fallback: true` → mensaje tipo “Mostrando métodos estimados”.
    - Si `coverage.covered === false` → “Este código postal no tiene cobertura automática, contáctanos”.
  - Si el fetch falla → toast + no avanzar de paso.

- **Paso 3** – Selección obligatoria antes de pagar
  - [handleCheckoutSubmit](cci:1://file:///c:/developer%20web/paginas/prototype/app/checkout/page.tsx:133:2-189:4) ya exige `selectedShippingMethod`.
  - Mantener esa validación y mensajes de error claros.

### 6.2. Resumen del pedido ([CheckoutSummary](cci:1://file:///c:/developer%20web/paginas/prototype/components/checkout/CheckoutSummary.tsx:21:0-122:1))

- **Archivo**: [components/checkout/CheckoutSummary.tsx](cci:7://file:///c:/developer%20web/paginas/prototype/components/checkout/CheckoutSummary.tsx:0:0-0:0).

- **Paso 1** – Evitar “envío gratis” por defecto
  - Cambiar la línea:
    - `const shippingCost = selectedShippingMethod?.cost || 0;`
  - Por algo del estilo:
    - `const shippingCost = selectedShippingMethod ? selectedShippingMethod.cost : null;`
  - Mostrar:
    - Si `shippingCost === null` → “Envío: a seleccionar”.
    - Si `shippingCost === 0` → “Envío: Gratis”.

- **Paso 2** – Mensaje comercial de envío gratis
  - Hoy está hardcodeado: “Envío gratuito en compras superiores a $5.000”.
  - Actualizarlo cuando:
    - Tengas un endpoint de configuración (`/api/config/shipping`) que devuelva `freeShippingThreshold`.
  - Mientras tanto, puedes:
    - Usar un texto genérico o asegurarte que el umbral 5.000 coincida con tu [calculateFallbackShipping](cci:1://file:///c:/developer%20web/paginas/prototype/lib/actions/me2-shipping.ts:252:0-293:1).

---

## 7. Fase 5 – Admin (configuración de envío)

### 7.1. Configuración de shipping en BD

- **Tablas ya existentes**:
  - `shippingMethods` en [lib/schema.ts](cci:7://file:///c:/developer%20web/paginas/prototype/lib/schema.ts:0:0-0:0) (con `freeThreshold`).
  - `mlShippingModes` (modos ML activos).
  - `AppConfig.shipping` en [types/common.ts](cci:7://file:///c:/developer%20web/paginas/prototype/types/common.ts:0:0-0:0).

- **Acciones**:
  - Añadir endpoints admin para:
    - Listar y actualizar métodos (`/api/admin/shipping-methods`).
    - Configurar umbral global `freeShippingThreshold`.
  - Ajustar la capa core para que:
    - Use `freeThreshold` / `freeShippingThreshold` antes de delegar a ML o fallback (si quieres una regla propia).

### 7.2. Panel admin

- **Objetivo**: que el admin pueda:
  - Ver y editar:
    - Umbral global de envío gratis.
    - Métodos activos/inactivos.
    - Modo ML (`me2`) y si está habilitado.

---

## 8. Fase 6 – Testing y debugging

### 8.1. Endpoint de pruebas de envío

- **Archivo**: [app/api/admin/test-shipping/route.ts](cci:7://file:///c:/developer%20web/paginas/prototype/app/api/admin/test-shipping/route.ts:0:0-0:0).

- **Uso**:
  - Probar combinaciones `{ zipcode, item_id, quantity, price, logisticType }`.
  - Confirmar que ME2 devuelve métodos y costos esperados.
  - Validar que fallback se active correctamente cuando ML falla.

### 8.2. Escenarios a probar

- **Tests recomendados**:
  - **CP con cobertura ME2** y producto con dimensiones válidas:
    - Deberías ver varios métodos ML.
  - **CP sin cobertura**:
    - Fallback local con métodos estándar / express.
  - **Producto mal configurado en ML**:
    - Log de error de ML + uso de fallback local.
  - **Compras por encima / debajo del umbral de envío gratis**:
    - Verificar que `cost === 0` y que el mensaje comercial coincide.

---

## 9. Estado final esperado

- **Usuario final**:
  - Siempre ve al menos una opción de envío razonable (o mensaje claro de sin cobertura).
  - Nunca ve “Envío Gratis” si no se cumple la lógica real.
- **Admin**:
  - Controla reglas de envío y envío gratis desde el panel.
- **Sistema**:
  - Usa ME2 como fuente principal de costos.
  - Tiene fallback local bien definido.
  - Integra correctamente con Mercado Pago y crea shipments en ML tras el pago.

---

Este plan está pensado para implementarse por fases; puedes convertir cada sección en tickets/PRs separados (Fase 1: core ME2, Fase 2: API envíos, Fase 3: checkout+MP, Fase 4: frontend, etc.).