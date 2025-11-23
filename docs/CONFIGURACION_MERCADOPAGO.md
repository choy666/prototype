# 🚀 Configuración de Mercado Pago - Guía de Setup

## 📋 Requisitos Críticos para Producción

Antes de continuar con la implementación, es **OBLIGATORIO** configurar tokens reales de Mercado Pago.

## 🔧 Paso 1: Configuración de Aplicación (Ya Completado)

1. **Iniciar sesión en Mercado Pago**
   - Ve a [https://www.mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers)
   - Inicia sesión con tu cuenta de Mercado Pago

2. **Crear Aplicación**
   - En el dashboard, ve a "Tus integraciones" → "Creá tu integración"
   - Selecciona "Checkout Pro" o "API de Pagos"
   - Dale un nombre a tu aplicación (ej: "Prototype Marketplace Dev")

3. **Obtener Credenciales de Sandbox**
   - Una vez creada la aplicación, ve a "Credenciales"
   - Copia los siguientes valores:
     - **Access Token**: `TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
     - **Public Key**: `TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

4. **Configurar Webhook**
   - En la misma página de credenciales, ve a la sección "Webhooks"
   - Configura la URL de producción: `https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago`
   - Configura la URL de desarrollo: `http://localhost:3000/api/webhooks/mercadopago`
   - Copia el **Webhook Secret** que te proporciona Mercado Pago

## ⚙️ Paso 2: Actualizar Variables de Entorno

Edita tu archivo `.env.local` con los valores reales:

```bash
# Tokens de producción (obtenidos del DevCenter)
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-3512407382157264-112123-63acaed36cb3246d2b1489bf710c4cb1-2926966384"
NEXT_PUBLIC_MP_PUBLIC_KEY="APP_USR-69258e52-a9c1-4d81-9d1e-90cf52391d49"
MERCADO_PAGO_WEBHOOK_SECRET="3268aa49b1c43eb2f43a9cc649d3081037308dd1317dc3c0ffb459b184ca4b6f"

# URLs de producción configuradas en Mercado Pago
MERCADO_PAGO_WEBHOOK_URL="https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago"
MERCADO_PAGO_SUCCESS_URL="https://prototype-ten-dun.vercel.app/payment-success"
MERCADO_PAGO_FAILURE_URL="https://prototype-ten-dun.vercel.app/payment-failure"
MERCADO_PAGO_PENDING_URL="https://prototype-ten-dun.vercel.app/payment-pending"

# Opcional: Personalizar descriptor en tarjeta
MERCADO_PAGO_STATEMENT_DESCRIPTOR="PROTOTYPE MARKETPLACE"
```

## 🧪 Paso 3: Probar Configuración

Usa el endpoint de prueba para verificar que todo funciona:

```bash
# GET para probar conexión a API
curl http://localhost:3000/api/mercadopago/test-connection

# POST para generar webhook de prueba (solo desarrollo)
curl -X POST http://localhost:3000/api/mercadopago/test-connection
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Conexión a API de Mercado Pago exitosa",
  "config": {
    "hasAccessToken": true,
    "hasPublicKey": true,
    "hasWebhookSecret": true,
    "isTestToken": false
  },
  "apiTest": {
    "connected": true,
    "responseTime": "250ms",
    "statusCode": 404
  }
}
```

## 🎯 Paso 4: Verificar Webhooks

1. **Desde Mercado Pago Dashboard:**
   - Ve a "Webhooks" en tu aplicación
   - Envía una notificación de prueba
   - Verifica que recibas el webhook en tu endpoint

2. **Logs del Sistema:**
   - Revisa los logs de tu aplicación para ver:
     - `"Webhook MercadoPago: Firma validada exitosamente"`
     - `"Webhook MercadoPago recibido"`

## ⚠️ Errores Comunes y Soluciones

### Error: "Access Token inválido"
- **Causa:** Usando placeholder `TEST-XXXXXXXX...`
- **Solución:** Copia el token real del dashboard de Mercado Pago

### Error: "Firma inválida"
- **Causa:** Webhook secret no configurado o incorrecto
- **Solución:** Configura `MERCADO_PAGO_WEBHOOK_SECRET` con el valor del dashboard

### Error: "Webhook no configurado"
- **Causa:** URL de webhook no configurada en Mercado Pago
- **Solución:** Configura la URL en la sección Webhooks del dashboard

## 🔄 Paso 5: Gestión de Entornos

Cuando estés listo para producción:

1. **Cambiar a Modo Producción:**
   - En el dashboard de Mercado Pago, activa el modo producción
   - Obtén los tokens de producción (no empiezan con TEST-)

2. **Actualizar Variables de Entorno:**
   ```bash
   MERCADO_PAGO_ACCESS_TOKEN="PROD-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
   NEXT_PUBLIC_MP_PUBLIC_KEY="APP_USR-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
   NODE_ENV="production"
   ```

3. **Verificar URL de Webhook:**
   - Asegúrate que la URL de producción sea accesible públicamente
   - Usa HTTPS obligatoriamente

## 📊 Checklist de Calidad Implementado

✅ **Items obligatorios:**
- [x] `items.quantity` - Siempre enviado
- [x] `items.unit_price` - Precio unitario incluido
- [x] `items.category_id` - Categoría para mejor aprobación
- [x] `notification_url` - Webhook configurado
- [x] `external_reference` - Referencia única
- [x] `back_urls` - URLs de redirección
- [x] `statement_descriptor` - Descriptor en tarjeta

✅ **Datos del comprador (recomendados):**
- [x] `payer.email` - Email del comprador
- [x] `payer.first_name` - Nombre del comprador
- [x] `payer.last_name` - Apellido del comprador
- [x] `payer.identification` - Identificación (si está disponible)
- [x] `payer.address` - Dirección (si está disponible)
- [x] `payer.phone` - Teléfono (si está disponible)

✅ **Seguridad:**
- [x] Validación de firma HMAC-SHA256
- [x] Tokens en variables de entorno
- [x] Logging estructurado con sanitización

## 🚀 Siguientes Pasos

Una vez configurados los tokens reales:

1. **Fase 2:** Sistema de reintentos con backoff exponencial
2. **Fase 3:** Dashboard de monitoreo de integraciones
3. **Fase 4:** Tests de integración automatizados

---

**Importante:** El proyecto ya está configurado con tokens de producción. Solo cambia a desarrollo si necesitas hacer pruebas locales.
