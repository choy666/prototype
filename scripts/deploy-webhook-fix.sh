#!/bin/bash
# Script de despliegue urgente para corrección de webhooks MercadoPago

echo "🚀 Iniciando despliegue de corrección crítica de webhooks..."

# 1. Verificar cambios críticos
echo "📋 Verificando cambios en HMAC verifier..."
if grep -q "templateVariants" lib/mercado-pago/hmacVerifier-fixed.ts; then
    echo "✅ Template multi-formato detectado"
else
    echo "❌ ERROR: No se encontraron las correcciones de template"
    exit 1
fi

# 2. Build y test rápido
echo "🔨 Building..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Build falló"
    exit 1
fi

echo "✅ Build exitoso"

# 3. Despliegue a producción
echo "🌐 Desplegando a producción..."
vercel --prod

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Despliegue falló"
    exit 1
fi

echo "✅ Despliegue completado"

# 4. Instrucciones post-despliegue
echo "📊 PRÓXIMOS PASOS:"
echo "1. Activar webhooks de prueba en dashboard MercadoPago"
echo "2. Monitorizar logs: '[HMAC] Validación multi-formato'"
echo "3. Verificar que 'validTemplate' no sea 'NONE'"
echo "4. Identificar formato correcto y limpiar código"
echo ""
echo "🔗 Dashboard MercadoPago: https://www.mercadopago.com.ar/developers"
echo "📈 Logs de producción: Vercel Functions logs"

echo "🎉 Corrección desplegada exitosamente"
