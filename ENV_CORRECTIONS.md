# Variables de Entorno Corregidas - Mercado Libre + Mercado Pago
# Basado en configuración de DevCenter y análisis del código

# ========================================
# MERCADO LIBRE - OAuth y Conexión
# ========================================
# DevCenter App ID: 8458968436453153
MERCADOLIBRE_CLIENT_ID="8458968436453153"
# DevCenter Client Secret: IA9SP48WNE2w5XXogwoGde6rtcvGQskq
MERCADOLIBRE_CLIENT_SECRET="IA9SP48WNE2w5XXogwoGde6rtcvGQskq"
# Callback OAuth (CORREGIDO - antes usaba URLs de pago)
MERCADOLIBRE_REDIRECT_URI="https://prototype-ten-dun.vercel.app/api/auth/mercadolibre/callback"
# Webhook de notificaciones de Mercado Libre
MERCADOLIBRE_WEBHOOK_URL="https://prototype-ten-dun.vercel.app/api/mercadolibre/webhooks"

# ========================================
# MERCADO PAGO - Checkout Pro y Pagos
# ========================================
# DevCenter User ID: 517448794
# DevCenter App ID: 6454601133735810
# Access Token: APP_USR-3512407382157264-112123-63acaed36cb3246d2b1489bf710c4cb1-2926966384
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-3512407382157264-112123-63acaed36cb3246d2b1489bf710c4cb1-2926966384"
# Public Key: APP_USR-69258e52-a9c1-4d81-9d1e-90cf52391d49
NEXT_PUBLIC_MP_PUBLIC_KEY="APP_USR-69258e52-a9c1-4d81-9d1e-90cf52391d49"
# Webhook Secret: 3268aa49b1c43eb2f43a9cc649d3081037308dd1317dc3c0ffb459b184ca4b6f
MERCADO_PAGO_WEBHOOK_SECRET="3268aa49b1c43eb2f43a9cc649d3081037308dd1317dc3c0ffb459b184ca4b6f"
# Webhook URL (CORREGIDO - nomenclatura consistente)
MERCADO_PAGO_WEBHOOK_URL="https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago"

# ========================================
# BACK URLs de Mercado Pago (Redirección de pago)
# ========================================
# Estas URLs son a donde redirige Mercado Pago después del pago
MERCADO_PAGO_SUCCESS_URL="https://prototype-ten-dun.vercel.app/payment-success"
MERCADO_PAGO_FAILURE_URL="https://prototype-ten-dun.vercel.app/payment-failure"
MERCADO_PAGO_PENDING_URL="https://prototype-ten-dun.vercel.app/payment-pending"

# ========================================
# CONFIGURACIÓN GENERAL DE LA APP
# ========================================
# URL base de la aplicación (para callbacks y redirecciones)
NEXT_PUBLIC_APP_URL="https://prototype-ten-dun.vercel.app"
# URL del dashboard (para redirecciones después de OAuth)
NEXT_PUBLIC_DASHBOARD_URL="https://prototype-ten-dun.vercel.app/dashboard"

# ========================================
# VARIABLES EXISTENTES (Mantener sin cambios)
# ========================================
# Database
DATABASE_URL="postgresql://..."
# NextAuth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://prototype-ten-dun.vercel.app"
# Otros...
NODE_ENV="production"
LOG_LEVEL="info"
