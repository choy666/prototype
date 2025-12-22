# Checklist de Producción - Integración Tiendanube

## 🚀 **Pre-Flight Checklist**

### **1. Variables de Entorno**

- [ ] `TIENDANUBE_APP_ID` configurado
- [ ] `TIENDANUBE_CLIENT_SECRET` configurado
- [ ] `TIENDANUBE_USER_AGENT` configurado
- [ ] `INTEGRATION_WEBHOOKS_BASE_URL` apuntando a URL pública
- [ ] `TIENDANUBE_REDIRECT_URI` configurada correctamente
- [ ] `INTEGRATION_TOKEN_ENCRYPTION_KEY` (32 chars) configurado

### **2. Base de Datos**

- [ ] Ejecutar migraciones: `npm run db:push`
- [ ] Verificar tablas de Tiendanube creadas:
  - `tiendanube_stores`
  - `tiendanube_webhooks_raw`
  - `tiendanube_product_mapping`
  - `tiendanube_customer_mapping`

### **3. URL Pública y Accesibilidad**

- [ ] Verificar que la URL pública sea accesible desde internet
- [ ] Probar webhook: `curl -X POST https://tudominio.com/api/tiendanube/webhooks`
- [ ] Configurar firewall/proxy si es necesario

## 🔧 **Configuración en Tiendanube**

### **4. Aplicación Tiendanube**

- [ ] App creada en panel de desarrolladores
- [ ] Scopes configurados:
  - `read_products`
  - `write_products`
  - `read_orders`
  - `write_orders`
  - `read_customers`
  - `write_customers`
- [ ] Redirect URI configurada: `https://tudominio.com/api/auth/tiendanube/callback`

### **5. Webhooks en Tiendanube**

- [ ] URL del webhook: `https://tudominio.com/api/tiendanube/webhooks`
- [ ] Eventos configurados:
  - [x] `order/created` (Obligatorio LGPD)
  - [ ] `order/paid` (Recomendado)
  - [ ] `order/cancelled` (Recomendado)
  - [x] `store/redact` (Obligatorio LGPD)
  - [x] `customers/redact` (Obligatorio LGPD)
  - [x] `customers/data_request` (Obligatorio LGPD)
  - [x] `app/uninstalled` (Recomendado)
- [ ] HMAC secret configurado y coincide con `TIENDANUBE_CLIENT_SECRET`

## 📦 **Sincronización de Productos**

### **6. Preparación de Productos**

- [ ] Generar SKUs para todos los productos: `npx tsx scripts/generate-skus.ts`
- [ ] Verificar que no haya productos sin SKU
- [ ] Verificar que todos los SKUs sean únicos

### **7. Sincronización Inicial**

- [ ] Conectar tienda: `/admin/tiendanube` → "Conectar Tiendanube"
- [ ] Sincronizar productos: `npx tsx scripts/sync-products-tiendanube.ts STORE_ID`
- [ ] Verificar mapeo en BD: `SELECT * FROM tiendanube_product_mapping`

## 🧪 **Testing y Validación**

### **8. Tests de Integración**

- [ ] Ejecutar tests completos: `npx tsx scripts/test-tiendanube-integration.ts STORE_ID`
- [ ] Verificar que todos los tests pasen
- [ ] Probar health-check: `/api/admin/tiendanube/health?storeId=STORE_ID`

### **9. Flujo de Órdenes**

- [ ] Crear orden de prueba en Tiendanube
- [ ] Verificar que llegue por webhook
- [ ] Confirmar que se cree en BD local
- [ ] Verificar mapeo de cliente
- [ ] Verificar mapeo de productos

## 🔒 **Seguridad y Monitoreo**

### **10. Seguridad**

- [ ] Webhooks solo aceptan POST
- [ ] Validación HMAC implementada
- [ ] Rate limiting configurado
- [ ] Logs de errores activados

### **11. Monitoreo**

- [ ] Logs con prefijos `[Tiendanube]` configurados
- [ ] Dashboard de métricas funcionando
- [ ] Alertas para webhooks fallidos
- [ ] Health checks periódicos

## 📝 **Documentación y Comunicación**

### **12. Documentación**

- [ ] Guía de instalación actualizada
- [ ] Documentación de API endpoints
- [ ] Guía de troubleshooting
- [ ] Contacto de soporte configurado

### **13. Comunicación al Equipo**

- [ ] Equipo de soporte entrenado
- [ ] Documentación compartida
- [ ] Procedimientos de escalada
- [ ] Checklist de incidencias

## ⚠️ **Pasos Críticos Faltantes**

### **14. Webhooks Pendientes (CRÍTICO)**

- [ ] Implementar handler para `order/paid` (líneas 406-412 en `/api/tiendanube/webhooks/route.ts`)
- [ ] Implementar handler para `order/cancelled` (líneas 406-412)
- [ ] Probar actualización de estados de órdenes

### **15. Mejoras Opcionales**

- [ ] Modo dry-run en sync de productos
- [ ] Token refresh automático para sync largos
- [ ] Queue system para sincronización asíncrona
- [ ] Dashboard de estado de sincronización

## 🚨 **Rollback Plan**

### **16. Plan de Reversión**

- [ ] Backup de BD antes de activar
- [ ] Script de desactivación de webhooks
- [ ] Procedimiento para volver a versión anterior
- [ ] Comunicación a clientes si es necesario

## ✅ **Verificación Final**

Antes de ir a producción, verificar:

```bash
# 1. Verificar configuración
curl https://tudominio.com/api/admin/tiendanube/health?storeId=TU_STORE_ID

# 2. Verificar webhooks
curl -X POST https://tudominio.com/api/tiendanube/webhooks \
  -H "Content-Type: application/json" \
  -d '{"event":"test","store_id":"TU_STORE_ID"}'

# 3. Verificar productos sincronizados
npx tsx scripts/test-tiendanube-integration.ts TU_STORE_ID
```

## 📞 **Soporte**

- **Documentación técnica**: `/docs/guia-tienda-tiendanube.md`
- **Logs**: Buscar prefijos `[Tiendanube]`
- **Contacto**: [tu-email@dominio.com]

---

## ⚡ **Quick Start**

```bash
# 1. Configurar variables
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 2. Migrar BD
npm run db:push

# 3. Generar SKUs
npx tsx scripts/generate-skus.ts

# 4. Conectar tienda
# Ir a /admin/tiendanube y conectar

# 5. Sincronizar productos
npx tsx scripts/sync-products-tiendanube.ts STORE_ID

# 6. Probar todo
npx tsx scripts/test-tiendanube-integration.ts STORE_ID
```

¡Listo para producción! 🎉
