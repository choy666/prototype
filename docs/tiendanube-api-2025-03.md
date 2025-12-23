# Integración con Tiendanube - API 2025-03

## Overview

Esta guía documenta la integración con Tiendanube utilizando la API oficial versión 2025-03. La integración permite sincronizar productos, gestionar envíos y procesar órdenes entre el sistema local y Tiendanube.

## Cambios importantes desde v1

1. **URL**: `/v1/{store_id}` → `/2025-03/{store_id}`
2. **Header**: `Authorization: Bearer` → `Authentication: bearer`
3. **User-Agent**: Ahora es obligatorio y debe incluir contacto

## Configuración de la API

### Base URL

```
https://api.tiendanube.com/2025-03/{store_id}
```

### Autenticación

La API utiliza OAuth 2.0 con el siguiente formato de headers:

```typescript
// Headers requeridos
{
  'Authentication': `bearer ${access_token}`,  // Notar: Authentication en singular, bearer en minúscula
  'User-Agent': 'AppName (contact@email.com)',  // Obligatorio
  'Content-Type': 'application/json; charset=utf-8'
}
```

## Flujo de OAuth

### 1. Iniciar conexión

```
GET /api/auth/tiendanube/connect
```

Redirige a:

```
https://api.tiendanube.com/apps/{app_id}/authorize?state={state}&redirect_uri={callback_url}
```

### 2. Callback de OAuth

```
GET /api/auth/tiendanube/callback?code={code}&state={state}
```

Procesa el código y obtiene el token:

```typescript
POST https://api.tiendanube.com/apps/authorize/token
{
  "client_id": "{app_id}",
  "client_secret": "{client_secret}",
  "grant_type": "authorization_code",
  "code": "{code}"
}
```

### 3. Token response

```json
{
  "access_token": "efc43bda420a6f1eecc5332f40533aed8aafe3fb",
  "token_type": "bearer",
  "scope": "read_content,write_content,read_products,write_products,...",
  "user_id": "7089578"
}
```

## Endpoints Principales

### Store Information

```typescript
GET /2025-03/{store_id}/store
```

### Products

```typescript
GET /2025-03/{store_id}/products
POST /2025-03/{store_id}/products
PUT /2025-03/{store_id}/products/{product_id}
```

### Shipping Carriers

```typescript
GET /2025-03/{store_id}/shipping_carriers
POST /2025-03/{store_id}/shipping_carriers/{carrier_id}/rates
```

### Orders

```typescript
GET /2025-03/{store_id}/orders
POST /2025-03/{store_id}/orders
PUT /2025-03/{store_id}/orders/{order_id}
```

## Configuración de Envíos

### 1. Configurar transportistas

Los transportistas se configuran en el panel de Tiendanube y se obtienen via API:

```typescript
const carriers = await fetch('/2025-03/7089578/shipping_carriers', {
  headers: {
    Authentication: 'bearer {token}',
    'User-Agent': 'MyApp (contact@email.com)',
  },
});
```

### 2. Calcular tarifas de envío

Para cada carrier disponible:

```typescript
const rates = await fetch('/2025-03/7089578/shipping_carriers/{carrier_id}/rates', {
  method: 'POST',
  headers: {
    Authentication: 'bearer {token}',
    'User-Agent': 'MyApp (contact@email.com)',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    destination_zip: '5500',
    weight: 1000,
    height: 20,
    width: 30,
    length: 40,
    declared_value: 22750,
    items_count: 1,
  }),
});
```

## Implementación en el Código

### Cliente Tiendanube Shipping

```typescript
export class TiendanubeShippingClient {
  private baseUrl = 'https://api.tiendanube.com/2025-03';
  private userAgent = 'Technocat-Integration/1.0 (contact@technocat.com)';

  async getCarriers(): Promise<TiendanubeCarrier[]> {
    const response = await fetch(`${this.baseUrl}/${this.storeId}/shipping_carriers`, {
      headers: {
        Authentication: `bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
      },
    });
    // ...
  }
}
```

### Servicio Unificado de Envíos

```typescript
const shippingParams: TiendanubeShippingParams = {
  origin_zip: settings.businessZipCode, // Código postal del negocio
  destination_zip: params.customerZip, // CP del cliente
  weight: totalWeight, // Peso total en gramos
  height: maxDimensions.height,
  width: maxDimensions.width,
  length: maxDimensions.length,
  declared_value: params.subtotal,
};
```

## Rate Limiting

La API incluye headers para controlar el rate limiting:

- `x-rate-limit-limit`: Límite total de requests
- `x-rate-limit-remaining`: Requests restantes
- `x-rate-limit-reset`: Milisegundos hasta el reset

## Paginación

Endpoints que retornan listas soportan paginación:

```typescript
GET /2025-03/{store_id}/products?page=1&per_page=50
```

Response incluye:

```json
{
  "data": [...],
  "paging": {
    "total": 150,
    "page": 1,
    "per_page": 50,
    "pages": 3
  }
}
```

## Manejo de Errores

### Common HTTP Status Codes

- `400 Bad Request`: Header User-Agent faltante
- `401 Unauthorized`: Token inválido o expirado
- `404 Not Found`: Endpoint no existe
- `415 Unsupported Media Type`: Content-Type faltante
- `422 Unprocessable Entity`: Datos inválidos en el body
- `429 Too Many Requests`: Rate limit exceeded

### Ejemplo de manejo de errores

```typescript
if (!response.ok) {
  if (response.status === 401) {
    // Token inválido - necesita reconexión
    await refreshTiendanubeToken();
  }
  throw new Error(`Tiendanube API Error ${response.status}: ${await response.text()}`);
}
```

## Webhooks

### Configuración

Los webhooks se registran durante la instalación de la app:

```typescript
// Webhooks registrados automáticamente:
// - app/uninstalled
// - order/created
// - order/updated
// - order/paid
// - order/cancelled
// - product/created
// - product/updated
// - product/deleted
```

### Endpoint de webhook

```typescript
POST / api / tiendanube / webhooks;
```

## Best Practices

### 1. Rate Limiting

- Respetar los límites de la API
- Implementar retry con backoff
- Usar caché para datos no críticos

### 2. Tokens

- Guardar tokens cifrados en la base de datos
- Implementar refresh automático si es necesario
- Validar tokens antes de usarlos

### 3. Logging

- Incluir store ID en todos los logs
- Loggear requests y responses de la API
- Monitorear errores 401 para reconexión

## Troubleshooting

### Problema: 401 Unauthorized

**Causa**: Header incorrecto o token inválido
**Solución**:

```typescript
// Verificar formato correcto
'Authentication': `bearer ${token}`  // No 'Authorization: Bearer'
```

### Problema: 400 Bad Request

**Causa**: User-Agent faltante
**Solución**: Agregar header obligatorio

```typescript
'User-Agent': 'AppName (contact@email.com)'
```

### Problema: No hay carriers

**Causa**: Tienda no tiene transportistas configurados
**Solución**: Configurar en panel de Tiendanube

## Testing

### Endpoint de prueba

```bash
curl -H "Authentication: bearer {token}" \
     -H "User-Agent: TestApp (test@email.com)" \
     https://api.tiendanube.com/2025-03/7089578/store
```

### Debug endpoints

- `GET /api/debug/tiendanube-carriers` - Ver carriers configurados
- `GET /api/debug/tiendanube-token-new` - Ver token info
- `POST /api/test/shipping-integration` - Probar flujo completo

## Recursos

- [Documentación oficial](https://tiendanube.github.io/api-documentation)
- [OAuth Guide](https://tiendanube.github.io/api-documentation/authentication)
- [API Reference](https://tiendanube.github.io/api-documentation/resources)
