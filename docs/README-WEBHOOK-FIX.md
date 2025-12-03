# 🔧 Corrección Webhook MercadoPago - Firma Inválida

## Problema Identificado
El webhook falla con "Ningún candidato coincidió con la firma recibida" debido a:

1. **Timestamp futuro**: `ts=1764716789` corresponde a junio 2025
2. **Firma HMAC inválida**: La firma no fue generada con el webhook secret correcto

## Solución Rápida

### 1. Usar el script generador
```bash
node scripts/webhook-test-generator.js
```

### 2. Comando curl corregido (ejemplo)
```bash
curl -X POST https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago \
  -H "x-request-id: test-1764798679" \
  -H "x-signature: ts=1764798679,v1=[FIRMA_GENERADA]" \
  -H "content-type: application/json" \
  -d '{"resource":"https://api.mercadolibre.com/merchant_orders/3607377642","topic":"merchant_order"}'
```

### 3. Verificar variables de entorno
Asegúrate que `MERCADO_PAGO_WEBHOOK_SECRET` esté configurado correctamente.

## Formato Exacto del String a Firmar
```
id:3607377642;request-id:test-1764798679;ts:1764798679
```

## Generación Manual de Firma
```bash
echo -n "id:3607377642;request-id:test-1764798679;ts:1764798679" | openssl dgst -sha256 -hmac "TU_WEBHOOK_SECRET"
```

## Próximos Pasos
1. Ejecuta el script para obtener una firma válida
2. Usa el comando curl generado
3. Verifica que el webhook responda HTTP 200
4. Revisa los logs para confirmar validación exitosa
