# Integración y sincronización Tiendanube (Nuvemshop) — Plan completo

## 0) Objetivo y alcance

Este documento define un **plan de implementación completo** para integrar este proyecto (Next.js + Drizzle) con **Tiendanube/Nuvemshop**, logrando:

- Sincronización de **productos + variantes + stock + precios**
- Sincronización de **órdenes + clientes**
- **Tiempo real** vía webhooks cuando sea posible
- **Fallback** por polling incremental (reconciliación eventual)
- **Multi-tienda** (multi-tenant) con tokens por tienda
- **Idempotencia** y tolerancia a reintentos (webhooks pueden llegar duplicados y desordenados)
- Enfoque **seguro**: secretos fuera del repo, tokens cifrados, HMAC en webhooks

## 1) Lectura obligatoria (fuentes oficiales)

- https://tiendanube.github.io/api-documentation/intro
- https://tiendanube.github.io/api-documentation/authentication
- https://tiendanube.github.io/api-documentation/resources/webhook
- https://tiendanube.github.io/api-documentation/resources/product
- https://tiendanube.github.io/api-documentation/resources/order
- https://dev.tiendanube.com/en/docs/homologation/guidelines

## 2) Conceptos clave (para no equivocarse)

- **store_id / user_id**: el `user_id` que devuelve OAuth es el **ID de la tienda** y se usa en la URL base de la API.
- **Base URL API** (vía docs):
  - `https://api.tiendanube.com/2025-03/{store_id}`
  - `https://api.nuvemshop.com.br/2025-03/{store_id}`
- **Headers obligatorios**:
  - `Authentication: bearer <ACCESS_TOKEN>`
  - `User-Agent: MiApp (contacto@email.com)` (**si falta, la API responde 400**)
  - `Content-Type: application/json; charset=utf-8` en POST/PUT/PATCH
- **Rate limit** (leaky bucket): por defecto ~2 req/s con ráfagas (bucket) de 40. Debe existir un limitador **por tienda**.
- **IDs externos**: algunos IDs (por ejemplo `products.id`) pueden requerir **int64**. Recomendación: guardar IDs externos como **`text`** (o `bigint`) en DB.

## 3) Variables de entorno recomendadas

No se deben commitear. Integrarlas a tu validación de entorno (`lib/utils/env-validation.ts`) cuando implementes.

- `TIENDANUBE_APP_ID`
- `TIENDANUBE_CLIENT_SECRET`
- `TIENDANUBE_API_BASE` (ej: `https://api.tiendanube.com/2025-03`)
- `TIENDANUBE_AUTH_BASE` (ej: `https://www.tiendanube.com`)
- `TIENDANUBE_USER_AGENT` (ej: `MiApp (dev@dominio.com)`)
- `INTEGRATION_TOKEN_ENCRYPTION_KEY` (clave para cifrar tokens en DB)
- `INTEGRATION_WEBHOOKS_BASE_URL` (tu URL pública base para webhooks)

## 4) Estrategia de sincronización (quién manda en cada dato)

La sincronización “total” requiere definir **ownership** (fuente de verdad) para evitar conflictos.

### 4.1) Matriz recomendada de ownership

- **Catálogo (producto/variante)**
  - **Recomendado**: tu sistema manda (local → Tiendanube).
  - Tiendanube puede editarse manualmente por el merchant; si querés permitirlo, tratá eso como:
    - **conflicto** (alerta + revisión manual), o
    - **last-write-wins** con timestamps.

- **Stock y precio**
  - Recomendado: **local manda** y se publica con `PATCH /products/stock-price` (bulk).
  - Si el merchant ajusta stock en Tiendanube, decidir:
    - bloquear cambios (documentación/proceso), o
    - aceptar inbound y reflejar en local (requiere reconciliación).

- **Órdenes**
  - Tiendanube manda (Tiendanube → local).
  - Tu sistema procesa: fulfillment, facturación, CRM, etc.

- **Clientes**
  - Tiendanube manda (Tiendanube → local), con cumplimiento de webhooks de privacidad.

### 4.2) Regla de oro

Para datos que nacen en Tiendanube (órdenes/clientes), **nunca** crear duplicados: usar upsert por `tiendanube_order_id` / `tiendanube_customer_id`.

## 5) Arquitectura recomendada (adaptada al proyecto)

### 5.1) Componentes

- **API Routes (Next.js)**
  - OAuth callback
  - Webhook receiver (rápido: validar + persistir + encolar)
  - Endpoints admin para:
    - ver estado de conexión por tienda
    - disparar import inicial
    - reintentar fallas / reprocesar webhooks

- **Cliente Tiendanube** (wrapper fetch)
  - inyecta headers obligatorios
  - rate limit por tienda
  - retry/backoff para 429/5xx

- **Capa de sincronización** (services/actions)
  - import inicial (bulk)
  - sync incremental (polling)
  - sync por evento (webhooks)
  - reconciliación (garantía eventual)

- **Persistencia (Drizzle)**
  - tokens cifrados por tienda
  - mapeos producto/variante
  - registro de webhooks + estado de procesamiento
  - cursores de polling

### 5.2) Estructura de carpetas sugerida

Sin obligarte a implementarlo igual, este layout mantiene el repo ordenado:

- `lib/clients/tiendanube.ts`
- `lib/services/tiendanube/*.ts`
- `lib/actions/tiendanube/*.ts`
- `app/api/tiendanube/oauth/callback/route.ts`
- `app/api/tiendanube/webhooks/route.ts`
- `app/api/admin/tiendanube/*` (panel/operaciones)

## 6) Modelo de datos (DB) recomendado

El proyecto ya usa Drizzle. La recomendación es **separar lo “externo” de lo “interno”** y guardar IDs externos como `text`.

### 6.1) Tabla `tiendanube_stores`

Campos sugeridos:

- `id` (PK local)
- `storeId` (text) — `user_id` de OAuth
- `accessTokenEncrypted` (text)
- `scopes` (text)
- `installedAt`, `uninstalledAt`
- `status` (enum: connected/disconnected/needs_reauth)
- `lastSyncAt`

### 6.2) Tabla `tiendanube_webhooks`

Objetivo: persistir cada entrega y procesar async.

- `id` (PK)
- `storeId` (text)
- `event` (text)
- `resourceId` (text)
- `payload` (jsonb)
- `hmacValid` (boolean)
- `processed` (boolean)
- `processedAt`
- `errorMessage`
- `retryCount`
- índices por `storeId`, `event`, `processed`

Nota: Tiendanube explícitamente indica que los webhooks pueden llegar **desordenados** y **duplicados**; tu “idempotencia” debe vivir en el procesamiento (upserts), no en “descartar por payload igual”.

### 6.3) Tabla `tiendanube_product_mapping`

- `storeId`
- `localProductId`
- `localVariantId` (opcional)
- `tiendanubeProductId` (text)
- `tiendanubeVariantId` (text)
- `sku` (text) (clave práctica para reconciliación)
- `syncStatus`, `lastSyncAt`, `lastError`

### 6.4) Órdenes y clientes

Dos opciones:

- **Opción A (recomendada)**: agregar campos `tiendanubeOrderId`, `tiendanubeCustomerId` a tus tablas existentes (si el producto lo amerita).
- **Opción B**: crear tablas puente (`tiendanube_orders`, `tiendanube_customers`) con FK a `orders/users`.

## 7) OAuth (instalación y conexión de tienda)

### 7.1) Flujo

1. Merchant instala desde:
   - `https://www.tiendanube.com/apps/{app_id}/authorize?state=...`
2. Tiendanube redirige a tu `redirect_uri` con `code` (expira en 5 minutos) y `state`.
3. Tu backend intercambia `code` por token:
   - `POST https://www.tiendanube.com/apps/authorize/token`
   - payload JSON con `client_id`, `client_secret`, `grant_type=authorization_code`, `code`.
4. Respuesta incluye:
   - `access_token`
   - `scope`
   - `user_id` (storeId)
5. Persistir:
   - `storeId`
   - token cifrado
   - scopes

### 7.2) Puntos críticos

- `state` es obligatorio (anti-CSRF). Guardar `state` en cookie o storage server-side y validarlo al volver.
- Tokens **no expiran**, pero quedan inválidos si:
  - se obtiene un token nuevo, o
  - se desinstala la app.

## 8) Cliente de API Tiendanube (estándar mínimo)

### 8.1) Reglas

- Siempre enviar `Authentication` y `User-Agent`.
- Respetar rate limit por tienda.
- Implementar retry con backoff para 429/5xx:
  - usar `x-rate-limit-reset` para esperar cuando haya 429.
  - agregar jitter para evitar thundering herd.
- Paginación:
  - `page` (arranca en 1)
  - `per_page` (hasta 200)
  - leer `x-total-count` cuando aplique

### 8.2) Endpoints clave

- **Productos**
  - listar: `GET /products?page=1&per_page=200`
  - obtener: `GET /products/{id}`
  - buscar por SKU: `GET /products/sku/{sku}`
  - crear: `POST /products`
  - actualizar: `PUT /products/{id}`
  - stock/precio bulk: `PATCH /products/stock-price` (hasta 50 variantes por request)

- **Órdenes**
  - listar: `GET /orders?page=1&per_page=200` (usar filtros por fecha/estado según docs)
  - detalle: `GET /orders/{id}`

- **Webhooks (configuración)**
  - `GET /webhooks`
  - `POST /webhooks`
  - `PUT /webhooks/{id}`
  - `DELETE /webhooks/{id}`

## 9) Webhooks (tiempo real)

### 9.1) Eventos típicos

- `product/created`, `product/updated`, `product/deleted`
- `order/created`, `order/updated`, `order/paid`, `order/cancelled`, etc.
- `customer/created`, `customer/updated`, `customer/deleted`
- `app/uninstalled`

### 9.2) Eventos requeridos por compliance

Obligatorios para aprobación/homologación (según docs):

- `store/redact`
- `customers/redact`
- `customers/data_request`

### 9.3) Verificación HMAC

Cada request incluye header:

- `x-linkedstore-hmac-sha256`

Se calcula como `HMAC_SHA256(raw_body, client_secret)`.

Puntos importantes:

- Validar contra el **raw body** (no el JSON ya parseado).
- Usar comparación en tiempo constante (timing-safe).

### 9.4) Patrón de procesamiento recomendado

- Recibir webhook
- Validar HMAC
- Guardar en `tiendanube_webhooks`
- Responder **2XX en <10s**
- Procesar async:
  - para `order/*`: llamar `GET /orders/{id}` y upsert
  - para `product/*`: llamar `GET /products/{id}` y upsert/mapeos
  - para `app/uninstalled`: marcar store como desconectada + limpiar datos según política
  - para compliance: ejecutar eliminación/export según lo requerido

### 9.5) Idempotencia real (sin “atajos”)

Tiendanube indica:

- el orden de entrega no está garantizado
- puede reenviar el mismo evento

Por lo tanto:

- diseñar cada handler como **idempotente**
- evitar side-effects no idempotentes (ej: “descontar stock local” dos veces) sin una llave de idempotencia

## 10) Polling incremental (fallback) y reconciliación

Incluso con webhooks, necesitás polling para:

- import inicial
- recuperar eventos perdidos
- reconciliar divergencias

### 10.1) Reglas

- Guardar cursor por tienda y recurso:
  - `lastOrdersSyncAt`, `lastProductsSyncAt`, etc.
- Traer por ventanas de tiempo y paginar.
- Límite de resultados: algunas queries pueden cortar en 10.000 (según docs de órdenes). Usar filtros por fecha.

### 10.2) Estrategia sugerida

- Import inicial:
  - productos (paginado)
  - órdenes (paginado + filtros por fecha)
- Reconciliación periódica:
  - cada X horas, traer cambios recientes y comparar con mappings

## 11) Seguridad y robustez

### 11.1) Secretos

- `client_secret` y `access_token` fuera del repo.
- Si alguna vez se expusieron, **rotarlos** en Partners.

### 11.2) Tokens en DB

- Guardar tokens **cifrados** (AES-GCM) usando `INTEGRATION_TOKEN_ENCRYPTION_KEY`.

### 11.3) Webhooks

- Verificar HMAC siempre.
- Responder rápido y procesar asíncrono.
- Loggear:
  - `storeId`
  - `event`
  - `resourceId`
  - `hmacValid`
  - `processed`

### 11.4) Rate limit

- Limitador por tienda.
- Reintentos con backoff.

## 12) Observabilidad (para que sea operable)

Recomendación:

- Logs estructurados con prefijo `[TIENDANUBE]`.
- Métricas por tienda en `integration_metrics` (ya existe):
  - `tiendanube.webhook.received`
  - `tiendanube.webhook.processed`
  - `tiendanube.api.429`
  - `tiendanube.sync.failures`

## 13) Testing y puesta en marcha

### 13.1) Desarrollo local

- Usar túnel (`npm run dev:tunnel`) para:
  - redirect_uri pública
  - webhook URL pública

### 13.2) Casos mínimos a probar

- OAuth completo (instalar, guardar storeId, token, scopes)
- API request con headers correctos (`User-Agent` y `Authentication`)
- Webhook con HMAC válido
- Webhook inválido (rechazar/registrar)
- Import inicial de productos (paginación)
- Import de órdenes con filtros (evitar 10.000 límite)
- Evento `app/uninstalled`
- Webhooks requeridos: `store/redact`, `customers/redact`, `customers/data_request`

## 14) Roadmap recomendado (por fases)

- **Fase 1 — Conexión**
  - OAuth callback + persistencia segura
  - cliente API con headers + rate limit

- **Fase 2 — Webhooks**
  - endpoint receptor + HMAC
  - tabla `tiendanube_webhooks` + procesamiento idempotente
  - registro automático de webhooks (`POST /webhooks`)

- **Fase 3 — Import/sync**
  - import inicial de productos/órdenes
  - mappings producto/variante
  - polling incremental

- **Fase 4 — Operación**
  - panel admin: estado, reprocesos, métricas
  - DLQ para errores repetidos

---

## Estado del documento

Este archivo es la guía de referencia para ejecutar `/tiendanube` y realizar una integración compacta, sólida y segura.
