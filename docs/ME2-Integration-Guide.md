# Mercado Envíos 2 (ME2) - Guía de Integración

## Overview

Implementación centralizada de Mercado Envíos 2 con validaciones robustas, cache de deduplicación, fallback controlado y manejo mejorado de errores.

## Arquitectura

### Flujo de Cálculo de Envío

```
Request (Frontend) 
    ↓
useShippingCalculator (debounce 400ms)
    ↓
/api/shipments/calculate (requestId)
    ↓
calculateME2Shipping (me2Api.ts)
    ↓
┌─────────────────────────────────────┐
│ 1. Validación Centralizada           │
│    - validateME2Calculation()        │
│    - Missing attributes tracking     │
│    - Fallback control                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. Cálculo de Dimensiones           │
│    - getValidatedME2Dimensions()     │
│    - Heurística avanzada             │
│    - Defaults por categoría          │
│    - Cache (30 min TTL)              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. API de Mercado Libre             │
│    - Llamada con retry/backoff       │
│    - Cache de deduplicación (30s)    │
│    - Promise cache para simultáneos  │
└─────────────────────────────────────┘
    ↓
Response (metadata + warnings)
```

### Flujo de Webhook Mercado Pago

```
Webhook Request
    ↓
Raw Body Reading (ANTES de parsear)
    ↓
HMAC SHA256 Validation
    ↓
JSON Parsing (después de validar)
    ↓
Payload Structure Validation
    ↓
Response 200 OK (inmediata)
    ↓
Background Processing
    ├── Payment API Call
    ├── Order Creation
    ├── Stock Deduction
    └── Retry/Dead Letter si falla
```

## Módulos Principales

### 1. me2Validator.ts
Validaciones centralizadas para productos ME2:
- **validateProductForME2()**: Validación individual
- **validateProductsForME2()**: Validación por lotes  
- **validateME2Calculation()**: Validación completa para request
- **calculateDimensions()**: Heurística de dimensiones

### 2. me2Dimensions.ts
Cálculo inteligente de dimensiones:
- **getValidatedME2Dimensions()**: Obtener dimensiones validadas
- **getDimensionsByCategory()**: Defaults por categoría
- **calculateHeuristicDimensions()**: Empaquetado optimizado
- **Cache en memoria** (30 min TTL)

### 3. me2Api.ts
API centralizada con cache y deduplicación:
- **calculateME2Shipping()**: Función principal
- **Cache por cartHash** (30s TTL)
- **Promise cache** para solicitudes simultáneas
- **Retry con backoff** para errores de conexión
- **Cleanup automático** (cada 5 min)

### 4. hmacVerifier.ts
Validación robusta de webhooks:
- **verifyHmacSHA256()**: Validación oficial Mercado Pago
- **verifyWebhookSignature()**: Soporte múltiple formatos
- **validateWebhookPayload()**: Validación de estructura

### 5. Frontend Components
- **useShippingCalculator.ts**: Hook con debounce y requestId
- **ShippingFallbackWarning.tsx**: Advertencias UX para fallback

## Variables de Entorno

```bash
# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=token_de_acceso
MERCADO_PAGO_WEBHOOK_SECRET=secreto_del_webhook

# Mercado Libre (opcional, para logs detallados)
MERCADOLIBRE_CLIENT_ID=client_id
MERCADOLIBRE_CLIENT_SECRET=client_secret
```

## Configuración de Base de Datos

### Campos ME2 en Products
```sql
ALTER TABLE products ADD COLUMN shipping_mode VARCHAR(20) DEFAULT 'me2';
ALTER TABLE products ADD COLUMN shipping_attributes JSONB;
ALTER TABLE products ADD COLUMN me2_compatible BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN ml_item_id VARCHAR(50);
```

### Campos ME2 en Categories
```sql
ALTER TABLE categories ADD COLUMN attributes JSONB;
ALTER TABLE categories ADD COLUMN me2_compatible BOOLEAN DEFAULT false;
```

## Endpoints

### POST /api/shipments/calculate
**Request:**
```json
{
  "zipcode": "1000",
  "items": [
    {
      "id": "1",
      "quantity": 2,
      "price": 1000,
      "mlItemId": "MLA123456"
    }
  ],
  "allowFallback": true,
  "requestId": "optional_client_id"
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "req_123456_abc123",
  "options": [
    {
      "name": "ME2 Standard",
      "cost": 2390,
      "estimated": "3-5 días"
    }
  ],
  "source": "me2",
  "fallback": false,
  "warnings": [],
  "metadata": {
    "calculationSource": "ME2",
    "calculationHash": "1000-1:2",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### POST /api/webhooks/mercadopago
**Headers:**
- `x-signature`: Firma HMAC (ts=...,v1=...)
- `x-request-id`: ID de request

**Request Body (RAW):**
```json
{
  "action": "payment.created",
  "data": { "id": "134990491149" }
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "req_789_def456",
  "message": "Pago recibido y encolado para procesamiento"
}
```

## Cache Strategy

### Tipos de Cache
1. **Dimensiones Cache** (30 min): Resultados de cálculo de dimensiones
2. **Calculation Cache** (30 s): Deduplicación de solicitudes de envío
3. **Promise Cache**: Evitar llamadas simultáneas idénticas

### Cache Keys
- **Dimensions**: `productIds.sort().join('-')`
- **Calculation**: Hash de `zipcode + items.sort()`

### Cleanup
- Automático cada 5 minutos
- Límite de 1000 entradas por cache
- LRU eviction cuando se excede límite

## Error Handling

### Jerarquía de Fallback
1. **ME2 API**: Intentar cálculo real
2. **Local Shipping**: Métodos configurados en BD
3. **Default Values**: Defaults por categoría
4. **Error Response**: Mensaje claro al usuario

### Tipos de Errores
- **VALIDATION_ERROR**: Datos inválidos (400)
- **AUTH_FAILED**: Sin token de acceso (401)
- **RATE_LIMIT**: Demasiadas solicitudes (429)
- **SHIPPING_FAILED**: Error en API externa (500)

## Monitoring y Debugging

### Logs Estructurados
Todos los logs incluyen:
- **requestId**: Para correlacionar solicitudes
- **source**: Componente que genera el log
- **metadata**: Contexto adicional

### Debug en Desarrollo
- Logs detallados sin sanitizar
- Mock de respuestas de API
- Skip de validación HMAC si no hay secret

### Health Check
```bash
GET /api/health/me2
```
Valida:
- Variables de entorno configuradas
- Conexión a base de datos
- Estado de caches

## Testing

### Unit Tests
- Validaciones de productos
- Cálculo de dimensiones
- Verificación HMAC

### Integration Tests
- Flujo completo de cálculo ME2
- Procesamiento de webhook
- Cache deduplicación

### E2E Tests
- Checkout completo
- Simulación de webhook real
- Comportamiento de fallback

## Performance Considerations

### Optimizaciones
- **Debounce**: 400ms en frontend
- **Cache**: 30s deduplicación backend
- **Batch Queries**: Obtener productos en lote
- **Lazy Loading**: Import dinámico de módulos

### Límites
- **Cache Size**: 1000 entradas máximo
- **Retry Count**: 3 intentos máximo
- **Timeout**: 10s serverless functions

## Security

### Validaciones
- **HMAC SHA256**: Firmas de webhook
- **Input Sanitization**: Zod schemas
- **Rate Limiting**: Headers de MP
- **SQL Injection**: Drizzle ORM

### Headers de Seguridad
- **CORS**: Configurado para dominios específicos
- **Content-Type**: Application/json
- **Authorization**: Bearer tokens

## Deployment

### Vercel Considerations
- **Cold Starts**: Cache se reinicia
- **Timeouts**: 10s máximo
- **Environment Variables**: Validadas en startup

### Production Checklist
- [ ] Variables de entorno configuradas
- [ ] Migraciones de BD aplicadas
- [ ] Webhooks configurados en MP
- [ ] Monitoreo de errores activo
- [ ] Logs estructurados funcionando

## Troubleshooting

### Issues Comunes
1. **Firma inválida**: Verificar webhook secret
2. **Productos sin mlItemId**: Configurar en BD
3. **Cache no funciona**: Revisar cold starts
4. **Timeouts**: Optimizar queries o usar edge

### Debug Commands
```bash
# Limpiar caches
curl -X POST /api/admin/cache/clear

# Validar configuración
curl -X GET /api/health/me2

# Simular webhook
curl -X POST /api/webhooks/mercadopago \
  -H "x-signature: ts=123,v1=abc" \
  -d '{"action":"payment.created","data":{"id":"test"}}'
```

## Future Improvements

### Roadmap
1. **Redis Cache**: Persistencia cross-instance
2. **Queue System**: SQS/SNS para webhooks
3. **Real-time Updates**: WebSocket para shipping
4. **ML Predictions**: ETA más preciso
5. **Multi-carrier**: Integración con otros proveedores

### Technical Debt
- Implementar persistencia real para failed webhooks
- Agregar tests automatizados CI/CD
- Optimizar queries de base de datos
- Implementar rate limiting a nivel de aplicación
