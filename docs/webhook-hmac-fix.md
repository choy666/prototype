# 🔧 Guía de Corrección HMAC Webhooks MercadoPago

## 🚨 Problema
100% de webhooks fallando con "Firma HMAC inválida"

## ✅ Pasos para Solución

### 1. Verificar Secret en Dashboard
```
1. Ir a https://www.mercadopago.com.ar/developers
2. Seleccionar aplicación
3. Webhooks → Editar
4. Copiar "Webhook Secret" exacto
5. Actualizar variable de entorno MERCADO_PAGO_WEBHOOK_SECRET
```

### 2. Validar Template de Firma
El template debe seguir exactamente el formato de MercadoPago:

```typescript
// Template correcto según documentación MP
const template = `data.id=${dataId};ts=${timestamp};x-request-id=${xRequestId}`;
```

### 3. Corregir Decodificación del Body
```typescript
// Usar buffer sin decodificar para HMAC
const rawBuffer = await req.arrayBuffer();
const rawBody = new Uint8Array(rawBuffer);
// No aplicar TextDecoder antes de HMAC
```

### 4. Implementar Fallback IP
Agregar whitelist de IPs de MercadoPago como fallback:

```typescript
const MERCADO_PAGO_IPS = [
  '52.200.68.18',
  '52.200.68.19',
  '54.79.52.26',
  // ... IPs oficiales
];
```

### 5. Testing Post-Corrección
```bash
# Simular webhook con herramienta de MP
curl -X POST https://tu-domain.com/api/webhooks/mercadopago \
  -H "x-signature: ts=1733325574;v1=abc123..." \
  -H "x-request-id: req-123" \
  -d '{"data":{"id":"12345"}}'
```

## 📊 Métricas a Monitorear
- Tasa de éxito HMAC > 95%
- Tiempo de procesamiento < 500ms
- Dead letter rate < 5%

## 🔄 Proceso de Validación
1. Actualizar secret en entorno
2. Desplegar cambios
3. Activar webhook de prueba en dashboard MP
4. Verificar logs de validación HMAC
5. Monitorizar por 24 horas
