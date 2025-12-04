# 🎯 Próximos Pasos - Webhook Funcionando

## ✅ Éxito Confirmado
- Webhook de prueba recibido con **200 OK**
- Correcciones HMAC funcionando
- Pagos volviendo a la normalidad

## 📊 Paso 1: Verificar Logs (Crítico)

Ejecutar en terminal:
```bash
vercel logs --limit 50
```

**Buscar en logs:**
```
[HMAC] Validación multi-formato
```

**Identificar:**
- `validTemplate`: Qué formato funcionó
- `isValid`: true
- `signatureComparison`: Buscar `match: true`

### Ejemplo esperado:
```json
{
  "validTemplate": "data.id=12345;ts=1733325574;x-request-id=req-abc",
  "isValid": true,
  "signatureComparison": [
    {
      "format": 1,
      "template": "data.id=12345;ts=1733325574;x-request-id=req-abc",
      "match": true  // ← ESTE ES EL FORMATO CORRECTO
    },
    {
      "format": 2,
      "template": "data.id=12345&ts=1733325574&x-request-id=req-abc",
      "match": false
    }
    // ... otros formatos
  ]
}
```

## 🔧 Paso 2: Optimizar Código

Una vez identificado el formato correcto (ej: formato 1):

### Editar `lib/mercado-pago/hmacVerifier-fixed.ts`

**Reemplazar el array `templateVariants` con solo el formato correcto:**

```typescript
// ANTES (9 formatos)
const templateVariants = [
  `data.id=${dataId};ts=${ts};x-request-id=${requestId}`,
  `data.id=${dataId}&ts=${ts}&x-request-id=${requestId}`,
  // ... 7 formatos más
];

// DESPUÉS (solo el correcto)
const template = `data.id=${dataId};ts=${ts};x-request-id=${requestId}`;
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(template, 'utf8')
  .digest('hex');

const isValid = v1 === expectedSignature;
```

### Simplificar logging:
```typescript
logger.info('[HMAC] Validación exitosa', {
  dataId,
  xRequestId,
  ts,
  template,
  isValid
});
```

## 🚀 Paso 3: Desplegar Versión Optimizada

```bash
npm run build
vercel --prod
```

## 📈 Paso 4: Monitorear Métricas

### Logs a buscar:
- `[HMAC] Validación exitosa` → Debería ver muchos
- `[HMAC] HMAC falló pero IP es de Mercado Pago` → Debería reducirse
- `webhook_failures` → Debería ser 0

### Métricas objetivo:
- ✅ Tasa éxito HMAC > 95%
- ✅ Dead letter rate < 5%
- ✅ Tiempo procesamiento < 500ms

## 🧪 Paso 5: Testing Adicional

### Probar diferentes tipos de webhooks:
1. `payment.created`
2. `payment.updated` 
3. `payment.failed`
4. `test.notification`

### Verificar que todos funcionen con el template optimizado.

## 🎉 Paso 6: Limpieza Final

### Archivos a remover/actualizar:
- `scripts/deploy-webhook-fix.sh` → Puede eliminarse
- `INSTRUCCIONES_DESPLIEGUE_URGENTE.md` → Archivar como referencia
- `docs/webhook-hmac-fix.md` → Actualizar con solución final

### Variables de entorno a verificar:
```bash
MERCADO_PAGO_WEBHOOK_SECRET  # Debe estar configurada
DEBUG_HMAC                   # Puede removerse
```

---

## 🆘 Si Algo Falla

### Si logs muestran `validTemplate: "NONE"`:
1. Verificar variable de entorno `MERCADO_PAGO_WEBHOOK_SECRET`
2. Revisar configuración en dashboard MercadoPago
3. El fallback IP debería estar funcionando igualmente

### Si sigue fallando después de optimizar:
1. Volver a versión multi-formato temporalmente
2. Contactar soporte MercadoPago para verificar formato actual

---

**ESTADO ACTUAL**: ✅ Webhooks funcionando, esperando optimización
**PRÓXIMO PASO**: Verificar logs y optimizar template
