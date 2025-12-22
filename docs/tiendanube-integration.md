# Integración con Tiendanube

## Overview

Esta documentación describe el flujo completo de integración con Tiendanube, incluyendo OAuth, webhooks, sincronización de datos y configuración para producción.

## Arquitectura

### Componentes Principales

1. **OAuth Flow**: Conexión segura entre la app y tiendas Tiendanube
2. **Webhook Receiver**: Recepción y procesamiento de eventos en tiempo real
3. **Data Sync**: Sincronización bidireccional de productos y órdenes
4. **Admin UI**: Panel de configuración y monitoreo

### Flujo de Datos

```
Tiendanube → Webhooks → API Local → Base de Datos
Local → API Tiendanube → Productos/Stock
```

## Configuración

### Variables de Entorno Requeridas

```bash
# Configuración de la App Tiendanube
TIENDANUBE_APP_ID=your_app_id
TIENDANUBE_CLIENT_SECRET=your_client_secret
TIENDANUBE_USER_AGENT=YourAppName/1.0

# Configuración de Webhooks
INTEGRATION_WEBHOOKS_BASE_URL=https://yourdomain.com
INTEGRATION_TOKEN_ENCRYPTION_KEY=your_32_char_encryption_key

# URLs (generadas automáticamente)
# Auth URL: https://www.tiendanube.com/apps/authorize
# Token URL: https://www.tiendanube.com/apps/authorize/token
# API Base: https://api.tiendanube.com/v1
```

### Configuración en Tiendanube

1. **Registrar la App**:
   - Ir a [Tiendanube Developers](https://www.tiendanube.com/apps/developer)
   - Crear nueva aplicación
   - Configurar Callback URL: `https://yourdomain.com/api/auth/tiendanube/callback`
   - Configurar Webhook URL: `https://yourdomain.com/api/tiendanube/webhooks`

2. **Scopes Requeridos**:
   ```
   read_products write_products
   read_orders write_orders
   read_customers write_customers
   read_stores write_stores
   webhooks
   ```

## Flujo de OAuth

### 1. Inicio de Conexión

```typescript
// Endpoint: POST /api/auth/tiendanube/connect
// Redirige a: https://www.tiendanube.com/apps/authorize
// Parámetros:
// - client_id: TIENDANUBE_APP_ID
// - response_type: code
// - scope: scopes solicitados
// - redirect_uri: callback URL
// - state: CSRF token (cookie segura)
```

### 2. Callback

```typescript
// Endpoint: GET /api/auth/tiendanube/callback
// Valida:
// - State contra cookie (CSRF protection)
// - Code no nulo
// Intercambia code por access_token
// Guarda token cifrado en tiendanube_stores
// Redirige a /admin/tiendanube?auth=success
```

### 3. Almacenamiento Seguro

- Tokens cifrados con AES-256
- Client secret necesario para descifrar
- Refresh token manejado automáticamente
- Tokens con expiración configurable

## Webhooks

### Eventos Implementados

#### LGPD (Requeridos)

- `store/redact`: Eliminar datos de la tienda
- `customers/redact`: Eliminar datos de clientes
- `customers/data_request`: Exportar datos de clientes

#### Operacionales

- `app/uninstalled`: Desinstalación de la app
- `order/created`: Nueva orden (sincronizar)
- `order/paid`: Orden pagada
- `order/cancelled`: Orden cancelada
- `product/created`: Producto creado
- `product/updated`: Producto actualizado

### Validación HMAC

```typescript
// Header: x-linkedstore-hmac-sha256
// Método: HMAC-SHA256 del body usando client_secret
// Comparación timing-safe para prevenir timing attacks
```

### Procesamiento

1. **Validación**: HMAC y tienda registrada
2. **Persistencia**: Guardar webhook raw antes de procesar
3. **Procesamiento**: Manejar según tipo de evento
4. **Reintentos**: Automático con backoff exponencial
5. **Logging**: Completo con contexto y métricas

## Sincronización de Datos

### Órdenes (Tiendanube → Local)

1. **Cliente**: Crear/actualizar usuario por email
2. **Mapeo**: Guardar en `tiendanube_customer_mapping`
3. **Orden**: Crear con campos `tiendanubeOrderId` y `tiendanubeShippingId`
4. **Items**: Buscar por SKU en `tiendanube_product_mapping`
5. **Envío**: Guardar dirección en `shippingAddress`

### Productos (Local → Tiendanube)

1. **SKU**: Generar `V-{variantId}` si no existe
2. **Mapeo**: Persistir en `tiendanube_product_mapping`
3. **Sync**: Enviar actualizaciones de stock/precio
4. **Errores**: Loggear y marcar para revisión manual

## Manejo de Errores

### Reintentos Automáticos

- **Backoff**: 60s \* 2^retryCount (máx 30min)
- **Límite**: 5 reintentos
- **Dead Letter**: Después del límite, marcar como dead_letter
- **Monitoreo**: Logs y métricas por tienda

### Tipos de Error

1. **Temporales**: Rate limit, timeouts, red
2. **Permanentes**: HMAC inválido, datos inválidos
3. **Configuración**: Tokens expirados, app no instalada

## Base de Datos

### Tablas Principales

```sql
-- Tiendas conectadas
tiendanube_stores (
  id, store_id, access_token_encrypted,
  scopes, status, installed_at, uninstalled_at
)

-- Webhooks crudos para reproceso
tiendanube_webhooks_raw (
  id, store_id, event, raw_body, headers,
  processed, retry_count, next_retry_at,
  status, error_message
)

-- Mapeo de productos
tiendanube_product_mapping (
  id, store_id, local_product_id, local_variant_id,
  tiendanube_product_id, tiendanube_variant_id,
  sku, sync_status
)

-- Mapeo de clientes
tiendanube_customer_mapping (
  id, store_id, tiendanube_customer_id, user_id
)
```

## Monitoreo

### Métricas Clave

- Webhooks recibidos/procesados/fallidos
- Tiempo de procesamiento promedio
- Cantidad de reintentos por evento
- Órdenes sincronizadas por hora
- Productos sincronizados por hora

### Logs

Prefijos para fácil filtrado:

- `[Tiendanube] Webhook:` - Eventos recibidos
- `[Tiendanube] Sync:` - Sincronización de datos
- `[Tiendanube] Retry:` - Reintentos automáticos
- `[Tiendanube] Error:` - Errores críticos

### Alertas Sugeridas

- Más de 10 webhooks fallidos en 5 min
- Tienda desconectada (app/uninstalled)
- Rate limit excedido
- Tokens expirados sin refresh

## Seguridad

### OAuth y Tokens

- HTTPS obligatorio en producción
- State token con SameSite=Lax
- Tokens cifrados en reposo
- Refresh automático antes de expiración

### Webhooks

- Validación HMAC obligatoria
- Replay attack protection (request ID único)
- IP whitelist si es posible
- Rate limiting por tienda

### Datos Sensibles

- Client secret en variable de entorno
- Encryption key dedicada
- Logs sin datos sensibles
- Cleanup automático de webhooks antiguos

## Deployment

### Vercel (Recomendado)

```bash
# Configurar variables
vercel env add TIENDANUBE_APP_ID production
vercel env add TIENDANUBE_CLIENT_SECRET production
vercel env add TIENDANUBE_USER_AGENT production
vercel env add INTEGRATION_WEBHOOKS_BASE_URL production
vercel env add INTEGRATION_TOKEN_ENCRYPTION_KEY production

# Deploy
vercel --prod
```

### Verificación Post-Deploy

1. **OAuth**: Probar flujo completo de conexión
2. **Webhooks**: Verificar registro en Tiendanube
3. **Sync**: Crear orden de prueba
4. **Monitoreo**: Revisar logs y métricas
5. **Admin**: Ver UI de configuración

## Troubleshooting

### Issues Comunes

1. **HMAC inválido**:
   - Verificar client secret
   - Confirmar encoding (hex vs base64)
   - Revisar body sin modificaciones

2. **Tokens expirados**:
   - Verificar refresh automático
   - Re-autenticar tienda
   - Revisar scopes correctos

3. **Webhooks no llegan**:
   - Verificar URL en dashboard Tiendanube
   - Confirmar HTTPS válido
   - Revisar logs de errores

4. **Órdenes no sincronizan**:
   - Verificar mapeo de productos
   - Revisar logs de warnings
   - Validar datos del cliente

### Debug Tools

```bash
# Ver webhooks recientes
GET /api/tiendanube/webhooks?storeId=xxx&limit=10

# Forzar retry manual
POST /api/admin/tiendanube/webhooks/retry
{ "storeId": "xxx" }

# Ver estado de conexión
GET /api/admin/tiendanube/status?storeId=xxx&verify=1
```

## Consideraciones de Performance

- **Batch processing**: Procesar webhooks en lotes
- **Caching**: Cache de tokens y datos de tienda
- **Rate limiting**: Respetar límites de API Tiendanube
- **Cleanup**: Limpieza automática de datos antiguos
- **Async**: Usar colas para sync pesadas

## Próximos Pasos

1. **Cron Jobs**: Para sync periódica de productos
2. **Dashboard**: Métricas en tiempo real
3. **Alerting**: Integración con Slack/Email
4. **Testing**: Suite de tests E2E
5. **Documentation**: API docs para clientes

## Soporte

- **Logs**: Siempre incluir request ID
- **Issues**: Template con datos de tienda y evento
- **Escalation**: Contactar a soporte Tiendanube si es problema de API
