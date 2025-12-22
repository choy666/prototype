# Guía de Producción - Integración Tiendanube

## 📋 Checklist Pre-Producción

### 1. Variables de Entorno

```bash
# Configuración Tiendanube (requerido)
TIENDANUBE_APP_ID=your_app_id
TIENDANUBE_CLIENT_SECRET=your_client_secret
TIENDANUBE_USER_AGENT=YourAppName/1.0

# URLs y seguridad (requerido)
INTEGRATION_WEBHOOKS_BASE_URL=https://yourdomain.com
INTEGRATION_TOKEN_ENCRYPTION_KEY=your_32_char_encryption_key
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your_nextauth_secret

# Base de datos (requerido)
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### 2. Configuración de la App en Tiendanube

1. **Registrar la App**:
   - Dashboard Tiendanube → Developers → Create App
   - Callback URL: `https://yourdomain.com/api/auth/tiendanube/callback`
   - Webhook URL: `https://yourdomain.com/api/tiendanube/webhooks`

2. **Scopes Requeridos**:

   ```
   read_products write_products
   read_orders write_orders
   read_customers write_customers
   read_stores write_stores
   webhooks
   ```

3. **Webhooks a Registrar**:
   - `store/redact`
   - `customers/redact`
   - `customers/data_request`
   - `app/uninstalled`
   - `order/created`
   - `order/paid`
   - `order/cancelled`

### 3. Base de Datos

Ejecutar migraciones:

```bash
npm run db:push
```

Verificar tablas creadas:

- `tiendanube_stores`
- `tiendanube_webhooks_raw`
- `tiendanube_product_mapping`
- `tiendanube_customer_mapping`
- `tiendanube_sync_state`

## 🚀 Deploy en Vercel

### 1. Configurar Variables

```bash
# Variables de entorno
vercel env add TIENDANUBE_APP_ID production
vercel env add TIENDANUBE_CLIENT_SECRET production
vercel env add TIENDANUBE_USER_AGENT production
vercel env add INTEGRATION_WEBHOOKS_BASE_URL production
vercel env add INTEGRATION_TOKEN_ENCRYPTION_KEY production
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add DATABASE_URL production
```

### 2. Deploy

```bash
vercel --prod
```

### 3. Verificar Cron Jobs

El archivo `vercel.json` configura:

- Sync de productos cada 15 minutos
- Health check cada 5 minutos

## 🔧 Post-Deploy

### 1. Verificar Conexión

1. Ir a `/admin/tiendanube`
2. Click "Conectar con Tiendanube"
3. Autorizar la app
4. Verificar estado "Conectado"

### 2. Registrar Webhooks

1. En el admin panel, click "Registrar Webhooks"
2. Verificar todos los eventos estén activos
3. Probar con webhook de prueba

### 3. Primera Sincronización

1. Click "Forzar Sync" en el dashboard
2. Monitorear logs en la consola de Vercel
3. Verificar productos se actualizan en Tiendanube

## 📊 Monitoreo

### Métricas Clave

- **Webhooks**: Recibidos/procesados/fallidos por hora
- **Sync**: Productos sincronizados y errores
- **Órdenes**: Sincronizadas y pendientes
- **Clientes**: Mapeos creados

### Logs Importantes

Prefijos para buscar en logs:

- `[Tiendanube] Webhook:` - Eventos recibidos
- `[Tiendanube] Sync:` - Sincronización
- `[Tiendanube] Retry:` - Reintentos automáticos
- `[Tiendanube] Error:` - Errores críticos

### Alertas Sugeridas

Configurar en Vercel o servicio externo:

- Más de 10 webhooks fallidos en 5 min
- Tienda desconectada (app/uninstalled)
- Rate limit excedido
- Tokens expirados sin refresh

## 🛠️ Troubleshooting

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
# Verificar estado de la tienda
curl https://yourdomain.com/api/admin/tiendanube/status?storeId=xxx

# Forzar refresh
curl -X POST https://yourdomain.com/api/auth/tiendanube/refresh \
  -H "Authorization: Bearer token"
```

#### Sync No Funciona

```bash
# Verificar último sync
curl https://yourdomain.com/api/admin/tiendanube/sync/products?storeId=xxx

# Forzar sync manual
curl -X POST https://yourdomain.com/api/admin/tiendanube/sync/products \
  -H "Content-Type: application/json" \
  -d '{"storeId":"xxx","force":true}'
```

#### Productos No Sincronizan

1. Verificar SKU en `tiendanube_product_mapping`
2. Revisar logs de errores de API
3. Chequear límites de rate limiting
4. Verificar campos `consecutiveFailures`

## 🔒 Seguridad

### Consideraciones

- **HTTPS obligatorio** en producción
- **Client secret** nunca en código
- **Encryption key** dedicada (32 chars)
- **Logs sin datos sensibles**
- **IP whitelist** para webhooks si es posible

### Validaciones

- HMAC SHA256 en todos los webhooks
- State token en OAuth (CSRF protection)
- Tokens cifrados en base de datos
- Rate limiting por tienda

## 📈 Optimización

### Performance

- **Batch updates**: 20 productos por lote
- **Rate limiting**: 500ms entre llamadas API
- **Caching**: 30s en métricas dashboard
- **Cleanup**: Webhooks antiguos (30 días)

### Escalabilidad

- **Cron jobs**: Distribuidos por Vercel
- **Retries**: Backoff exponencial automático
- **Dead letter**: Productos problemáticos pausados
- **Monitoring**: Métricas en tiempo real

## 🔄 Mantenimiento

### Tareas Mensuales

1. Limpiar webhooks antiguos
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

Siempre incluir en tickets:

- Store ID
- Request ID (de headers)
- Timestamp exacto
- Logs relevantes con prefijos

## 🎯 Próximos Pasos (Opcionales)

1. **Cola de Redis/BullMQ**: Para mejor manejo de sync pesados
2. **Dashboard Avanzado**: Con gráficos históricos
3. **Alerting**: Integración Slack/Email
4. **Testing**: Suite E2E automatizada
5. **Multi-store**: Soporte para múltiples tiendas

---

## ✅ Verificación Final

Antes de considerar la integración lista:

- [ ] OAuth flow completo y funcionando
- [ ] Webhooks registrados y recibiendo eventos
- [ ] Sync de productos funcionando automáticamente
- [ ] Órdenes sincronizándose correctamente
- [ ] Dashboard mostrando métricas
- [ ] Logs estructurados y accesibles
- [ ] Alertas configuradas
- [ ] Documentación actualizada

La integración está lista para producción cuando todos los puntos estén verificados.
