# 📋 SOLUCIONES COMPLETAS - INTEGRACIÓN MERCADO LIBRE + MERCADO PAGO

## 🎯 **Resumen Ejecutivo**

He analizado la configuración actual y detectado **discrepancias críticas** que impiden el correcto funcionamiento de la integración. Los problemas principales se centran en **confusión entre flujos de OAuth de Mercado Libre y callbacks de pago de Mercado Pago**, además de configuraciones incorrectas en DevCenter.

---

## 🔍 **A. Diagnóstico Final**

### 🔴 **Mercado Libre - Errores Críticos**
1. **Redirect URI Incorrecta**: DevCenter tiene configuradas URLs de pago (`/payment-success`, `/payment-failure`, `/payment-pending`) en lugar del callback OAuth correcto
2. **Falta de Callback OAuth**: No existe la ruta `/api/auth/mercadolibre/callback` en DevCenter
3. **Webhook Equivocado**: Usa webhook de Mercado Pago en lugar de webhook de Mercado Libre
4. **Scopes No Definidos**: No se especifican los scopes necesarios para la aplicación

### 🟡 **Mercado Pago - Errores Críticos**
1. **Back URLs Correctas**: Las URLs de redirección están bien configuradas
2. **Webhook Correcto**: El webhook está bien configurado
3. **Tokens Válidos**: Las credenciales son correctas y coinciden con DevCenter

### 🟠 **Backend / DevCenter - Problemas Estructurales**
1. **Confusión Conceptual**: Se mezclan callbacks de OAuth con back_urls de pago
2. **Falta de Separación**: No hay distinción clara entre ML OAuth y MP pagos
3. **Variables de Entorno**: Algunas variables tienen nombres inconsistentes

---

## 🛠️ **B. Correcciones Específicas**

### **1. Corrección DevCenter - Mercado Libre**

**Configuración Actual (INCORRECTA):**
```
Redirect URIs: https://prototype-ten-dun.vercel.app/payment-success, https://prototype-ten-dun.vercel.app/payment-failure, https://prototype-ten-dun.vercel.app/payment-pending
Notificaciones callbacks URL: https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago
```

**Configuración Correcta:**
```
Redirect URI: https://prototype-ten-dun.vercel.app/api/auth/mercadolibre/callback
Notificaciones callbacks URL: https://prototype-ten-dun.vercel.app/api/mercadolibre/webhooks
Scopes recomendados: read write offline_access
```

### **2. Variables de Entorno - Correcciones**

**Variables Actuales (con problemas):**
```env
MERCADO_LIBRE_APP_ID="8458968436453153"
MERCADO_LIBRE_CLIENT_SECRET="IA9SP48WNE2w5XXogwoGde6rtcvGQskq"
MERCADO_LIBRE_REDIRECT_URI_SUCCESS="https://prototype-ten-dun.vercel.app/payment-success"
MERCADO_LIBRE_REDIRECT_URI_FAILURE="https://prototype-ten-dun.vercel.app/payment-failure"
MERCADO_LIBRE_REDIRECT_URI_PENDING="https://prototype-ten-dun.vercel.app/payment-pending"
```

**Variables Corregidas:**
```env
# Mercado Libre - OAuth
MERCADO_LIBRE_APP_ID="8458968436453153"
MERCADO_LIBRE_CLIENT_SECRET="IA9SP48WNE2w5XXogwoGde6rtcvGQskq"
MERCADO_LIBRE_REDIRECT_URI="https://prototype-ten-dun.vercel.app/api/auth/mercadolibre/callback"
MERCADO_LIBRE_WEBHOOK_URL="https://prototype-ten-dun.vercel.app/api/mercadolibre/webhooks"

# Mercado Pago - Checkout Pro
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-3512407382157264-112123-63acaed36cb3246d2b1489bf710c4cb1-2926966384"
NEXT_PUBLIC_MP_PUBLIC_KEY="APP_USR-69258e52-a9c1-4d81-9d1e-90cf52391d49"
MERCADO_PAGO_WEBHOOK_SECRET="3268aa49b1c43eb2f43a9cc649d3081037308dd1317dc3c0ffb459b184ca4b6f"
MERCADO_PAGO_WEBHOOK_URL="https://prototype-ten-dun.vercel.app/api/webhooks/mercadopago"

# Back URLs de Mercado Pago
MERCADO_PAGO_SUCCESS_URL="https://prototype-ten-dun.vercel.app/payment-success"
MERCADO_PAGO_FAILURE_URL="https://prototype-ten-dun.vercel.app/payment-failure"
MERCADO_PAGO_PENDING_URL="https://prototype-ten-dun.vercel.app/payment-pending"
```

---

## 💻 **C. Código Modelo**

### **1. Callback OAuth de Mercado Libre - CORRECTO**

```typescript
// app/api/auth/mercadolibre/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = request.cookies.get('oauth_state')?.value;

  // Validar state CSRF
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`
    );
  }

  try {
    // Intercambiar code por access_token
    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.MERCADO_LIBRE_APP_ID,
        client_secret: process.env.MERCADO_LIBRE_CLIENT_SECRET,
        code: code,
        redirect_uri: process.env.MERCADO_LIBRE_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(`Error en token: ${tokenData.message}`);
    }

    // Guardar tokens en base de datos
    await saveTokensToDatabase(tokenData);

    // Limpiar cookie state
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?auth=success`
    );
    response.cookies.delete('oauth_state');
    
    return response;
  } catch (error) {
    console.error('Error en callback ML:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=token_exchange_failed`
    );
  }
}
```

### **2. Creación de Preferencia Mercado Pago - CORRECTA**

```typescript
// app/api/mercadopago/create-preference/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    const { items, orderId } = await request.json();

    const preference = new Preference(client);
    
    const result = await preference.create({
      body: {
        items: items.map(item => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          currency_id: 'ARS',
        })),
        back_urls: {
          success: process.env.MERCADO_PAGO_SUCCESS_URL,
          failure: process.env.MERCADO_PAGO_FAILURE_URL,
          pending: process.env.MERCADO_PAGO_PENDING_URL,
        },
        auto_return: 'approved',
        notification_url: process.env.MERCADO_PAGO_WEBHOOK_URL,
        external_reference: orderId.toString(),
        statement_descriptor: 'Prototype Store',
      },
    });

    return NextResponse.json({
      init_point: result.init_point,
      preference_id: result.id,
    });
  } catch (error) {
    console.error('Error creando preferencia:', error);
    return NextResponse.json(
      { error: 'Error creando preferencia de pago' },
      { status: 500 }
    );
  }
}
```

### **3. Webhook Mercado Pago - CORRECTO**

```typescript
// app/api/webhooks/mercadopago/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-signature');
    const requestId = request.headers.get('x-request-id');

    // Verificar firma del webhook
    if (!verifyWebhookSignature(body, signature, requestId)) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }

    const data = JSON.parse(body);

    if (data.type === 'payment') {
      const paymentId = data.data.id;
      
      // Obtener detalles del pago
      const payment = await getPaymentDetails(paymentId);
      
      // Procesar según estado
      switch (payment.status) {
        case 'approved':
          await handleApprovedPayment(payment);
          break;
        case 'pending':
          await handlePendingPayment(payment);
          break;
        case 'rejected':
        case 'cancelled':
          await handleRejectedPayment(payment);
          break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error webhook MP:', error);
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 });
  }
}

function verifyWebhookSignature(body: string, signature: string | null, requestId: string | null): boolean {
  if (!signature || !requestId) return false;
  
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(requestId + body)
    .digest('hex');
    
  return `v1=${expectedSignature}` === signature;
}
```

### **4. Webhook Mercado Libre - CORRECTO**

```typescript
// app/api/mercadolibre/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Procesar notificaciones de Mercado Libre
    if (data.topic === 'orders') {
      const orderId = data.resource.split('/').pop();
      await handleOrderNotification(orderId);
    }
    
    if (data.topic === 'items') {
      const itemId = data.resource.split('/').pop();
      await handleItemNotification(itemId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error webhook ML:', error);
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 });
  }
}
```

---

## ✅ **D. Checklist Final de Validación**

### **🔵 Mercado Libre OAuth**
- [ ] DevCenter configurado con: `https://prototype-ten-dun.vercel.app/api/auth/mercadolibre/callback`
- [ ] Callback implementa validación de `state`
- [ ] Tokens guardados correctamente en BD
- [ ] Refresh token implementado y funcionando
- [ ] Scopes configurados: `read write offline_access`

### **🟡 Mercado Pago Checkout**
- [ ] Back URLs configuradas correctamente en DevCenter
- [ ] Preferencias creadas con `auto_return: "approved"`
- [ ] Webhook respondiendo en `/api/webhooks/mercadopago`
- [ ] Verificación de firma implementada
- [ ] Procesamiento de estados: approved/pending/rejected

### **🟣 Backend General**
- [ ] Variables de entorno corregidas y consistentes
- [ ] Separación clara entre flujos ML y MP
- [ ] Logs implementados para debugging
- [ ] Manejo de errores robusto
- [ ] MCP Servers usando tokens correctos

### **🔧 DevCenter**
- [ ] ML: Redirect URI apunta a callback OAuth
- [ ] ML: Webhook apunta a `/api/mercadolibre/webhooks`
- [ ] MP: Back URLs apuntan a páginas de pago
- [ ] MP: Webhook apunta a `/api/webhooks/mercadopago`

---

## 🎯 **E. Recomendaciones y Buenas Prácticas**

### **1. Seguridad**
- **Siempre** validar el `state` en OAuth de Mercado Libre
- **Siempre** verificar la firma en webhooks de Mercado Pago
- Usar HTTPS en todas las URLs
- Rotar secretos periódicamente

### **2. Monitoreo**
- Implementar logs detallados en todos los callbacks
- Monitorear expiración de tokens de ML
- Alertas por fallos en webhooks
- Métricas de conversión de pagos

### **3. Testing**
- Probar OAuth en sandbox antes de producción
- Simular pagos de prueba en MP
- Validar webhooks con herramientas como ngrok
- Tests unitarios para callbacks

### **4. Manejo de Errores**
- Implementar reintentos automáticos para webhooks
- Páginas de error amigables para usuarios
- Logs de errores con contexto suficiente
- Sistema de notificaciones para fallos críticos

---

## 🚀 **Pasos Inmediatos para Corregir**

1. **Actualizar DevCenter ML** con la redirect URI correcta
2. **Corregir variables de entorno** según el formato propuesto
3. **Implementar callback OAuth** con validación de state
4. **Configurar webhook separado** para Mercado Libre
5. **Probar flujo completo** en sandbox
6. **Monitorear logs** y validar funcionamiento

---

## 📞 **Soporte y Referencias**

- **Documentación ML OAuth**: https://developers.mercadolibre.com/es_ar/autenticacion-y-autorizacion
- **Documentación MP Checkout**: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/integrations
- **Status de APIs**: https://status.mercadolibre.com/
- **Soporte ML**: https://www.mercadolibre.com/ayuda

---

**⚠️ Importante**: Realiza estos cambios en orden y prueba cada componente antes de pasar al siguiente. La confusión entre callbacks de OAuth y back_urls de pago es la raíz de la mayoría de los problemas actuales.
