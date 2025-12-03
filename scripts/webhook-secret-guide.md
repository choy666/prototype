# 🚨 GUÍA PARA CORREGIR WEBHOOK SECRET DE MERCADOPAGO

## Problema Detectado
- ❌ Webhook secret actual: `c427...8dfd` (no coincide con MercadoPago)
- ❌ Todos los webhooks fallan con `signaturesMatch: false`
- ✅ Variables de entorno cargadas correctamente

## 🎯 Solución Paso a Paso

### 1. Acceder al Dashboard de MercadoPago
1. Ve a: https://www.mercadopago.com.ar/developers/panel/applications
2. Selecciona tu aplicación (checkout pro)
3. Ve a la sección "Webhooks" o "Notificaciones"

### 2. Obtener el Webhook Secret Correcto
1. Busca la URL del webhook: `https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago`
2. El webhook secret se muestra cuando creas o editas la URL
3. Si no lo ves, haz clic en "Regenerar" o "Crear nuevo secret"

### 3. Actualizar en Vercel
```bash
# Agregar el secret real en producción
vercel env add MERCADO_PAGO_WEBHOOK_SECRET production

# Verificar que esté configurado correctamente
vercel env ls production | grep MERCADO_PAGO_WEBHOOK_SECRET

# Sincronizar localmente
vercel env pull .env.local
```

### 4. Redespliegue CRÍTICO ⚠️
```bash
# IMPORTANTE: Las variables de entorno no toman efecto hasta redeploy
vercel --prod
```

### 5. Verificar Actualización Post-Deploy
```bash
# Verificar que el nuevo secret esté siendo usado
node scripts/debug-webhook-secret.js

# O probar con webhook real desde el dashboard de MercadoPago
```

## 🔍 Verificación Manual
Para verificar el secret manualmente:
1. Copia el secret del dashboard
2. Compáralo con tu `.env.local`
3. Deben ser idénticos (64 caracteres hex)

## ⚠️ Notas Importantes
- El webhook secret solo se muestra una vez cuando se crea
- Si lo pierdes, debes regenerarlo en el dashboard
- Después de regenerar, actualiza tanto el dashboard como Vercel
- Los webhooks antiguos fallarán hasta que actualices el secret

## 🎉 Confirmación de Funcionamiento
Una vez corregido, los logs deberían mostrar:
- ✅ `signaturesMatch: true`
- ✅ `Webhook MercadoPago: Firma válida`
- ✅ Procesamiento normal de webhooks

## 🆘 Si Sigue Fallando
1. Verifica que el webhook URL esté activa en el dashboard
2. Confirma que el secret sea de 64 caracteres hex
3. Revisa que no haya espacios o caracteres extraños
4. Prueba con un webhook de test desde el dashboard
