# Checklist de Deploy para Producción - MercadoPago Checkout

## ✅ Variables de Entorno Verificadas
Todas las variables críticas han sido validadas exitosamente:
- ✅ APP_URL: https://prototype-ten-dun.vercel.app
- ✅ NEXT_PUBLIC_APP_URL: https://prototype-ten-dun.vercel.app
- ✅ NEXTAUTH_URL: https://prototype-ten-dun.vercel.app
- ✅ DATABASE_URL (Neon)
- ✅ MERCADO_PAGO_ACCESS_TOKEN (Producción)
- ✅ NEXT_PUBLIC_MP_PUBLIC_KEY
- ✅ MERCADO_PAGO_WEBHOOK_SECRET
- ✅ MERCADO_PAGO_NOTIFICATION_URL

## 🔧 Configuración Requerida en MercadoPago

### 1. Aplicación en MercadoPago
- **Tipo**: Producción
- **URL de retorno**: `https://prototype-ten-dun.vercel.app`
- **URL de notificaciones**: `https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago`

### 2. Credenciales de Producción
- **Access Token**: `APP_USR-4139456255448018-101508-30747435c7ebba43879b7e69055d3e14-2926966384`
- **Public Key**: `APP_USR-2880d7a3-8d60-4ec8-ba83-c57f3c8da89e`

### 3. Webhooks Configurados
- **URL**: `https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago`
- **Eventos**:
  - `payment.created`
  - `payment.updated`
  - `payment.approved`
  - `payment.cancelled`
  - `payment.rejected`

## 🚀 URLs de Redirección en el Código

### Back URLs (configuradas correctamente)
```typescript
back_urls: {
  success: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?order_id=${order.id}`,
  failure: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/failure?order_id=${order.id}`,
  pending: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/pending?order_id=${order.id}`,
}
```

### Notification URL
```typescript
notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`
```

## 📋 Pasos para Deploy

### 1. Deploy en Vercel
```bash
# Hacer push a la rama main/production
git add .
git commit -m "Deploy production con MercadoPago checkout"
git push origin main
```

### 2. Verificar Variables en Vercel
```bash
# Ver variables actuales
vercel env ls

# Si faltan, agregar las necesarias
vercel env add MERCADO_PAGO_ACCESS_TOKEN production
vercel env add NEXT_PUBLIC_MP_PUBLIC_KEY production
vercel env add MERCADO_PAGO_WEBHOOK_SECRET production
```

### 3. Configurar Webhook en MercadoPago
1. Ir a [MercadoPago Developers](https://www.mercadopago.com.ar/developers/panel)
2. Seleccionar aplicación de producción
3. Ir a "Webhooks"
4. Crear webhook con URL: `https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago`
5. Seleccionar eventos de pago

### 4. Probar en Producción
1. **Crear usuario de prueba** (si no existe)
2. **Agregar productos al carrito**
3. **Ir a checkout**
4. **Completar pago** con tarjeta de prueba:
   - Número: `5031 7557 3453 0604`
   - Vencimiento: `11/30`
   - CVV: `123`
5. **Verificar** que se recibe el webhook y se actualiza el estado

## 🧪 Testing en Producción

### Script de Verificación
```bash
# Ejecutar después del deploy
npm run check:env
```

### Endpoints a Probar
- `GET /api/auth/csrf` - Debe retornar token CSRF
- `POST /api/checkout` - Debe crear preferencia de MP
- `POST /api/webhooks/mercadopago` - Debe procesar webhooks
- `GET /api/order-status?order_id=123` - Debe retornar estado

## ⚠️ Consideraciones Importantes

### Rate Limiting
- Implementado para prevenir abuso
- Configurado para 10 requests por minuto por IP

### Seguridad
- ✅ Validación de precios y stock en servidor
- ✅ Verificación de firma HMAC en webhooks
- ✅ Rate limiting activado
- ✅ Logging completo de operaciones

### Manejo de Errores
- ✅ Rollback automático de stock en caso de fallo
- ✅ Categorización de errores para debugging
- ✅ Logging estructurado con Winston

## 🔍 Monitoreo Post-Deploy

### Logs a Revisar
- Logs de Vercel para errores de aplicación
- Logs de MercadoPago para transacciones
- Base de datos para estados de órdenes

### Métricas a Monitorear
- Tasa de conversión de checkout
- Errores de pago
- Tiempos de respuesta de webhooks
- Stock de productos

## 📞 Soporte

Si hay problemas en producción:
1. Revisar logs de Vercel
2. Verificar configuración de webhooks en MP
3. Comprobar variables de entorno
4. Revisar conectividad con base de datos

---
**Estado**: ✅ Listo para deploy en producción
