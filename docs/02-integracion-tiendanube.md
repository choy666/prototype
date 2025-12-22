# Integración Completa con Tiendanube/Nuvemshop

## 🎯 Overview

Integración bidireccional entre el e-commerce local y Tiendanube, permitiendo sincronización de productos, gestión de órdenes y clientes en tiempo real mediante webhooks.

## 📋 Requisitos Previos

### Variables de Entorno

```bash
# Configuración Tiendanube (requerido)
TIENDANUBE_APP_ID=your_app_id
TIENDANUBE_CLIENT_SECRET=your_client_secret
TIENDANUBE_USER_AGENT=YourAppName/1.0

# URLs y seguridad (requerido)
INTEGRATION_WEBHOOKS_BASE_URL=https://yourdomain.com
INTEGRATION_TOKEN_ENCRYPTION_KEY=your_32_char_encryption_key
```

### Configuración en Tiendanube

1. **Registrar App** en [Tiendanube Developers](https://www.tiendanube.com/apps/developer)
2. **Callback URL**: `https://yourdomain.com/api/auth/tiendanube/callback`
3. **Webhook URL**: `https://yourdomain.com/api/tiendanube/webhooks`
4. **Scopes requeridos**:
   ```
   read_products write_products
   read_orders write_orders
   read_customers write_customers
   read_stores write_stores
   webhooks
   ```

## 🏗️ Arquitectura

### Flujo de Datos

```
Tiendanube → Webhooks → API Local → Base de Datos
Local → API Tiendanube → Productos/Stock
```

### Componentes Principales

1. **OAuth Flow**: Conexión segura entre app y tiendas
2. **Webhook Receiver**: Recepción y procesamiento de eventos
3. **Data Sync**: Sincronización bidireccional
4. **Admin UI**: Panel de configuración y monitoreo

## 🔐 Flujo de OAuth

### 1. Inicio de Conexión

```typescript
// POST /api/auth/tiendanube/connect
// Redirige a: https://www.tiendanube.com/apps/authorize
```

### 2. Callback

```typescript
// GET /api/auth/tiendanube/callback
// Valida state, intercambia code por access_token
// Guarda token cifrado en tiendanube_stores
```

### 3. Almacenamiento Seguro

- Tokens cifrados con AES-256
- Client secret necesario para descifrar
- Tokens sin expiración (se invalidan al obtener nuevo)

## 📡 Webhooks

### Eventos Implementados

#### LGPD (Obligatorios)

- `store/redact`: Eliminar datos de tienda
- `customers/redact`: Eliminar datos de clientes
- `customers/data_request`: Exportar datos de clientes

#### Operacionales

- `app/uninstalled`: Desinstalación de app
- `order/created`: Nueva orden
- `order/paid`: Orden pagada
- `order/cancelled`: Orden cancelada
- `product/created/updated/delted`: Gestión de productos

### Validación HMAC

```typescript
// Header: x-linkedstore-hmac-sha256
// Método: HMAC-SHA256 del body usando client_secret
```

### Procesamiento

1. Validar HMAC y tienda registrada
2. Persistir webhook raw antes de procesar
3. Manejar según tipo de evento
4. Reintentos automáticos con backoff
5. Logging completo con contexto

## 🔄 Sincronización de Datos

### Órdenes (Tiendanube → Local)

1. **Cliente**: Crear/actualizar usuario por email
2. **Mapeo**: Guardar en `tiendanube_customer_mapping`
3. **Orden**: Crear con `tiendanubeOrderId` y `tiendanubeShippingId`
4. **Items**: Buscar por SKU en `tiendanube_product_mapping`
5. **Envío**: Guardar dirección en `shippingAddress`

### Productos (Local → Tiendanube)

1. **SKU**: Generar `V-{variantId}` si no existe
2. **Mapeo**: Persistir en `tiendanube_product_mapping`
3. **Sync**: Enviar actualizaciones de stock/precio
4. **Errores**: Loggear y marcar para revisión

## 🗄️ Base de Datos

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

## 🛠️ Personalización de Tienda

### Theme Manager

1. Ir a `/admin/tiendanube` → "Theme Manager"
2. Ingresar Store ID de la tienda
3. Personalizar mediante:

#### CSS Personalizado

```css
:root {
  --tn-primary: #3b82f6;
  --tn-secondary: #64748b;
}

.btn-primary {
  background: var(--tn-primary);
  border-radius: 8px;
}
```

#### JavaScript Personalizado

```javascript
document.querySelectorAll('.product-card').forEach((card) => {
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-4px)';
  });
});
```

### Build de Assets

```bash
npm run build:tiendanube
```

## 📊 Monitoreo

### Métricas Clave

- Webhooks recibidos/procesados/fallidos
- Tiempo de procesamiento promedio
- Órdenes sincronizadas por hora
- Productos sincronizados por hora

### Logs

Prefijos para filtrar:

- `[Tiendanube] Webhook:` - Eventos recibidos
- `[Tiendanube] Sync:` - Sincronización
- `[Tiendanube] Retry:` - Reintentos
- `[Tiendanube] Error:` - Errores críticos

## 🚨 Troubleshooting

### Issues Comunes

#### HMAC Inválido

```bash
# Verificar client secret
echo $TIENDANUBE_CLIENT_SECRET

# Probar webhook manualmente
curl -X POST https://yourdomain.com/api/tiendanube/webhooks \
  -H "x-linkedstore-hmac-sha256: calculated_signature" \
  -d '{"event":"test","data":{}}'
```

#### Tokens Expirados

```bash
# Verificar estado
curl https://yourdomain.com/api/admin/tiendanube/status?storeId=xxx

# Forzar refresh
curl -X POST https://yourdomain.com/api/auth/tiendanube/refresh
```

#### Sync No Funciona

1. Verificar SKU en `tiendanube_product_mapping`
2. Revisar logs de errores de API
3. Chequear rate limits
4. Verificar `consecutiveFailures`

## 🔒 Seguridad

### Consideraciones

- HTTPS obligatorio en producción
- Client secret nunca en código
- Encryption key dedicada (32 chars)
- Logs sin datos sensibles
- Rate limiting por tienda

### Validaciones

- HMAC SHA256 en todos los webhooks
- State token en OAuth (CSRF protection)
- Tokens cifrados en base de datos
- IP whitelist para webhooks si es posible

## 📈 Checklist de Producción

### Pre-Deploy

- [ ] Variables de entorno configuradas
- [ ] Migraciones ejecutadas (`npm run db:push`)
- [ ] App registrada en Tiendanube
- [ ] URLs configuradas correctamente
- [ ] HTTPS válido en dominio público

### Post-Deploy

- [ ] OAuth flow completo funcionando
- [ ] Webhooks registrados y activos
- [ ] Sync de productos automático
- [ ] Órdenes sincronizándose
- [ ] Dashboard mostrando métricas
- [ ] Logs estructurados accesibles

## 🔄 Mantenimiento

### Tareas Mensuales

1. Limpiar webhooks antiguos (30 días)
2. Revisar productos con fallos consecutivos
3. Actualizar documentación
4. Verificar límites de API

### Tareas Trimestrales

1. Auditoría de seguridad
2. Optimización de queries
3. Actualización de dependencias
4. Review de logs y alertas

## 📞 Soporte

### Contacto Tiendanube

- Developer Support: developers@tiendanube.com
- Documentación: https://developers.tiendanube.com
- Límites API: 1000 requests/hora por app

### Debug Info

Incluir siempre en tickets:

- Store ID
- Request ID (headers)
- Timestamp exacto
- Logs relevantes con prefijos

---

## 🎯 Próximos Pasos (Opcionales)

1. **Cola de Redis/BullMQ**: Para mejor manejo de sync pesados
2. **Dashboard Avanzado**: Con gráficos históricos
3. **Alerting**: Integración Slack/Email
4. **Testing**: Suite E2E automatizada
5. **Multi-store**: Soporte para múltiples tiendas
