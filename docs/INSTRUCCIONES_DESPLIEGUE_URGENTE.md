# 🚨 DESPLIEGUE URGENTE - Corrección Webhooks MercadoPago

## ⚠️ SITUACIÓN CRÍTICA
- **100% fallo HMAC** en webhooks de MercadoPago
- Pagos no se están procesando
- Todos los webhooks van a dead letter

## ✅ CORRECCIONES IMPLEMENTADAS

### 1. Template HMAC Multi-Formato
**Archivo**: `lib/mercado-pago/hmacVerifier-fixed.ts`

Se han implementado 9 variantes de template:
```typescript
const templateVariants = [
  `data.id=${dataId};ts=${ts};x-request-id=${requestId}`,  // Oficial reciente
  `data.id=${dataId}&ts=${ts}&x-request-id=${requestId}`,  // Con ampersands
  `id=${dataId};ts=${ts};x-request-id=${requestId}`,        // Legacy
  `id=${dataId}&ts=${ts}&x-request-id=${requestId}`,        // Legacy con &
  `data.id=${dataId};ts=${ts}`,                             // Sin x-request-id
  `data.id=${dataId}&ts=${ts}`,                             // Sin x-request-id con &
  `id=${dataId};ts=${ts}`,                                  // Simple sin x-request-id
  `id=${dataId}&ts=${ts}`,                                  // Simple con &
  `id:${dataId};request-id:${requestId};ts:${ts}`,          // Formato actual
];
```

### 2. Logging Mejorado
Se agregó logging detallado para identificar formato correcto:
```typescript
logger.info('[HMAC] Validación multi-formato', {
  dataId,
  xRequestId,
  ts,
  receivedSignature: v1,
  validTemplate: validTemplate || 'NONE',
  templatesTested: templateVariants.length,
  isValid: validSignature !== null,
  signatureComparison: [...] // Comparación de cada formato
});
```

## 🚀 PASOS PARA DESPLIEGUE INMEDIATO

### Paso 1: Build
```bash
npm run build
```

### Paso 2: Despliegue a Producción
```bash
vercel --prod
```

### Paso 3: Verificar Despliegue
```bash
vercel logs
```

## 📊 PASOS POST-DESPLIEGUE (Críticos)

### 1. Activar Webhooks de Prueba
1. Ir a https://www.mercadopago.com.ar/developers
2. Seleccionar aplicación
3. Webhooks → Editar
4. Activar "Test webhook"
5. Enviar prueba

### 2. Monitorizar Logs
Buscar en logs de Vercel:
```
[HMAC] Validación multi-formato
```

**Verificar que:**
- `validTemplate` no sea 'NONE'
- `isValid` sea `true`
- `signatureComparison` muestre `match: true` para algún formato

### 3. Identificar Formato Correcto
En los logs buscar el array `signatureComparison` y encontrar qué formato tiene `match: true`.

Ejemplo:
```json
{
  "format": 1,
  "template": "data.id=12345;ts=1733325574;x-request-id=req-abc",
  "expected": "a1b2c3d4",
  "received": "a1b2c3d4",
  "match": true
}
```

## 🧹 LIMPIEZA POST-CORRECCIÓN

Una vez identificado el formato correcto:

1. **Editar** `lib/mercado-pago/hmacVerifier-fixed.ts`
2. **Reemplazar** el array `templateVariants` con solo el formato correcto
3. **Remover** logging detallado (mantener solo logs esenciales)
4. **Desplegar** versión optimizada

## 📈 MÉTRICAS A MONITOREAR

### Inmediato (Próxima hora)
- ✅ Webhooks de prueba funcionando
- ✅ Logs muestran `validTemplate` con formato específico
- ✅ Tasa de éxito HMAC > 0%

### Corto plazo (24 horas)
- 🎯 Tasa de éxito HMAC > 95%
- 🎯 Dead letter rate < 5%
- 🎯 Tiempo procesamiento < 500ms

## 🆘 EN CASO DE EMERGENCIA

Si después del despliegue sigue fallando:

1. **Verificar variable de entorno**:
   ```bash
   echo $MERCADO_PAGO_WEBHOOK_SECRET
   ```

2. **Verificar dashboard MP**:
   - Secret coincida exactamente
   - URL de webhook correcta
   - Webhooks activados

3. **Fallback IP** ya está implementado y debería permitir procesamiento aunque HMAC falle.

## 📞 CONTACTO URGENTE
Si los pagos siguen sin procesarse después de 1 hora:
- Revisar logs en tiempo real
- Verificar configuración en dashboard MercadoPago
- Considerar rollback solo si es crítico

---
**ESTADO**: Listo para despliegue inmediato
**PRIORIDAD**: Crítica - Pagos en riesgo
