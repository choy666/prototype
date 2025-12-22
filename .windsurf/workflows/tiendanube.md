---
auto_execution_mode: 1
description: tiendanube
---

# Sincronización TOTAL Tiendanube (plan operativo)

## Objetivo

- **Sincronización bidireccional y consistente**
- **Productos + variantes + stock + precios**
- **Pedidos + clientes**
- **Tiempo real** vía webhooks cuando sea posible
- **Fallback** por polling incremental seguro
- **Multi-tienda** (multi-tenant)
- **Tolerante a fallos** (reintentos + DLQ)
- **Idempotente** (dedup + upserts)

## Material oficial (lectura obligatoria)

- https://dev.tiendanube.com/docs
- https://dev.tiendanube.com/docs/applications/authentication
- https://tiendanube.github.io/api-documentation/intro
- https://tiendanube.github.io/api-documentation/authentication
- https://tiendanube.github.io/api-documentation/resources/webhook
- https://dev.tiendanube.com/en/docs/homologation/guidelines

## Seguridad (no negociable)

- **Nunca commitear credenciales** en workflows o docs.
- Si un `client_secret` ya se expuso en git, **rotarlo/regenerarlo** en el panel de partners y actualizar entornos.
- Guardar `access_token` por tienda **encriptado en DB** (AES-GCM) o mediante un secret manager.

## Variables de entorno sugeridas

- `TIENDANUBE_APP_ID`
- `TIENDANUBE_CLIENT_SECRET`
- `TIENDANUBE_API_BASE` (ej: `https://api.tiendanube.com/2025-03` o `https://api.nuvemshop.com.br/2025-03`)
- `TIENDANUBE_AUTH_BASE` (ej: `https://www.tiendanube.com` o `https://www.nuvemshop.com`)
- `TIENDANUBE_USER_AGENT` (formato requerido: `MiApp (contacto@email.com)`)
- `INTEGRATION_TOKEN_ENCRYPTION_KEY`
- `INTEGRATION_WEBHOOKS_BASE_URL` (tu URL pública para webhooks)

## Entregables técnicos (mínimos)

1. **OAuth callback**: endpoint para recibir `code` e intercambiar por `access_token` + `store_id`.
2. **Cliente API Tiendanube**: wrapper fetch con:
   - Header `Authentication: bearer <token>`
   - Header `User-Agent` obligatorio
   - Rate limit 2 rps (por tienda)
   - Retry con backoff ante 429/5xx
3. **Modelo DB** (Drizzle) para:
   - Stores (tokens + scopes)
   - Mapeos (producto/variante)
   - Import de órdenes
   - Registro y reproceso de webhooks
   - Estado de polling incremental
4. **Webhooks**:
   - Endpoint receptor con verificación HMAC `x-linkedstore-hmac-sha256`
   - Registro de webhooks vía API (`POST /webhooks`)
   - Manejo de eventos clave: `order/*`, `product/*`, `customer/*`, `app/uninstalled`
   - Webhooks requeridos por compliance: `store/redact`, `customers/redact`, `customers/data_request`
5. **Polling fallback** (incremental):
   - Pull por ventanas de tiempo + paginación
   - Reconstrucción eventual consistente
6. **Observabilidad**:
   - Métricas por tienda (éxitos, latencia, 429, fallos)
   - Dashboard de fallos / reintentos

## Checklist rápido de implementación (orden recomendado)

1. Crear app en Partners y definir scopes mínimos.
2. Implementar OAuth callback y persistencia segura de credenciales por tienda.
3. Implementar cliente API + rate limit + retry.
4. Implementar tablas de sincronización + mapeos.
5. Implementar webhooks (verify HMAC + guardar + procesar idempotente).
6. Implementar polling incremental (fallback) + reconciliación.
7. Pruebas: túnel (`npm run dev:tunnel`) + fixtures + tests de integración.

## Guía completa

Ver `integracionNube.md`.
