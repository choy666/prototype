# Integración Completa con Mercado Libre

## 🎯 Overview

Integración bidireccional con Mercado Libre para sincronización de productos, gestión de órdenes y cálculo de envíos con Mercado Envíos 2.0.

## 📋 Configuración Inicial

### Variables de Entorno

```bash
# Mercado Libre
ML_APP_ID=your_app_id
ML_CLIENT_SECRET=your_client_secret
ML_REDIRECT_URI=https://yourdomain.com/api/auth/mercadolibre/callback

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_PUBLIC_KEY=...
MERCADOPAGO_WEBHOOK_SECRET=...
```

### Registrar App en Mercado Libre

1. Ir a [Mercado Libre Developers](https://developers.mercadolibre.com)
2. Crear nueva aplicación
3. Configurar Redirect URI
4. Obtener App ID y Client Secret

## 🏗️ Flujo de OAuth

### 1. Conexión

```typescript
// POST /api/auth/mercadolibre/connect
// Redirige a: https://auth.mercadolibre.com.ar/authorization
```

### 2. Callback

```typescript
// GET /api/auth/mercadolibre/callback
// Intercambia code por access_token
// Guarda token en base de datos
```

### 3. Refresh Automático

- Tokens expiran en 6 horas
- Refresh token válido por 6 meses
- Sistema actualiza automáticamente

## 📦 Sincronización de Productos

### Preparación de Productos

#### 1. Categorías

- Usar categorías hoja de Mercado Libre
- Configurar `ml_category_id` en el producto
- Ver atributos requeridos por categoría

#### 2. Atributos Obligatorios

Consultar atributos por categoría:

```bash
GET /categories/{category_id}/attributes
```

Atributos comunes requeridos:

- **Marca** (`BRAND`)
- **Modelo** (`MODEL`)
- **Condición** (`new`/`used`)
- **Atributos específicos** por categoría

#### 3. SKU y Variantes

- Generar SKU único: `V-{variantId}`
- Configurar variantes con atributos permitidos
- Respetar límites de cantidad por tipo de publicación

### Reglas de Stock y Cantidad

#### Política de Stock

```typescript
// Publicaciones FREE → siempre 1 unidad
if (listing_type_id === 'free') {
  available_quantity = 1;
} else {
  available_quantity = stock_local;
}
```

#### Categorías con Restricciones

Algunas categorías solo permiten cantidad = 1:

- MLA1055 (Celulares)
- MLA1652 (Accesorios para Vehículos)
- Y otras según combinación categoría/condición/listing

### Flujo de Sincronización

#### 1. Crear/Actualizar Producto

```bash
POST /api/mercadolibre/products/sync
```

- Valida atributos requeridos
- Calcula `available_quantity` según política
- Crea o actualiza publicación en ML
- Guarda `mlItemId` y estado de sync

#### 2. Sincronización de Stock

```bash
POST /api/mercadolibre/products/sync/inventory
```

- Lee stock real de BD
- Calcula cantidad según políticas
- Actualiza `available_quantity` en ML
- Nunca pisa stock local con datos de ML

## 📋 Gestión de Órdenes

### Importación de Órdenes

```typescript
// GET /api/mercadolibre/orders/import
```

#### Flujo:

1. Obtiene órdenes desde API de ML
2. Verifica si ya fue importada
3. Crea orden local si no existe
4. Mapea items a productos locales
5. **Descuenta stock transaccionalmente**
6. Registra importación

### Deducción de Stock en Ventas ML

Dentro de una transacción:

1. Busca variantes con stock suficiente
2. Si encuentra, descuenta de variante
3. Si no, descuenta de producto base
4. Registra en `stockLogs`
5. Todo o nada (rollback en error)

## 🚚 Mercado Envíos 2.0 (ME2)

### Configuración

```typescript
// Endpoint: /api/shipments/calculate
```

#### Requisitos del Producto

- Peso en gramos (`weight`)
- Dimensiones: alto, ancho, largo (cm)
- `shipping_mode`: "me2"
- `shipping_attributes` completos
- `me2Compatible: true`

#### Cálculo de Envío

```typescript
// Input
{
  zip_code: "1001",
  items: [{
    id: "123",
    weight: 500,
    dimensions: { height: 10, width: 20, length: 15 },
    price: 10000,
    quantity: 2
  }]
}

// Output
{
  options: [{
    name: "ME2 Standard",
    cost: 2390,
    estimated: "3-5 días"
  }]
}
```

### Validaciones ME2

- Dimensiones mínimas: 2cm x 2cm x 1cm, 10g
- Peso máximo por paquete: 25kg
- Suma de dimensiones ≤ 200cm

## 🗄️ Base de Datos - Tablas Clave

### Products

```sql
-- Campos ML
ml_item_id VARCHAR(50),
ml_category_id VARCHAR(20),
ml_condition VARCHAR(20),
ml_buying_mode VARCHAR(20),
ml_listing_type_id VARCHAR(20),
ml_sync_status VARCHAR(20),
ml_last_sync TIMESTAMP,
ml_permalink TEXT,
sync_error TEXT
```

### Product Variants

```sql
-- Para variantes con SKUs
sku VARCHAR(100) UNIQUE,
ml_variation_id VARCHAR(50)
```

### Stock Logs

```sql
-- Historial de movimientos
productId, variantId, oldStock, newStock,
change, reason, userId, created_at
```

### MercadoLibre Orders Import

```sql
mlOrderId, localOrderId, status, importedAt
```

## 🔍 Monitoreo y Logs

### Prefijos de Logs

- `[ML] Sync:` - Sincronización de productos
- `[ML] Order:` - Importación de órdenes
- `[ME2] Request:` - Cálculo de envíos
- `[ME2] Response:` - Respuesta de envíos
- `[ME2] Error:` - Errores de ME2

### Métricas Importantes

- Productos sincronizados/hora
- Órdenes importadas/hora
- Errores de sincronización
- Tiempo de procesamiento

## 🛠️ Troubleshooting

### Errores Comunes

#### "Faltan atributos obligatorios"

```bash
# 1. Consultar atributos requeridos
GET /categories/{category_id}/attributes

# 2. Completar en el producto
- Marca (BRAND)
- Modelo (MODEL)
- Atributos específicos
```

#### "item.available_quantity.invalid"

- Usar publicación `free` → cantidad = 1
- Usar publicación `gold_special` → cantidad real
- Verificar restricciones por categoría

#### Sync no funciona

1. Verificar token válido
2. Revisar `mlSyncStatus`
3. Consultar `sync_error`
4. Forzar sync manual

### Comandos Útiles

```bash
# Forzar sync de producto
curl -X POST /api/mercadolibre/products/sync \
  -d '{"productId": "123"}'

# Ver estado de sync
curl /api/mercadolibre/products/status?productId=123

# Sincronizar inventario
curl -X POST /api/mercadolibre/products/sync/inventory
```

## 📊 Dashboard de Administración

### Secciones ML

- **Conexión**: OAuth y estado del token
- **Categorías**: Sincronización con atributos
- **Productos**: Estado de sincronización
- **Órdenes**: Importación y errores
- **Métricas**: Estadísticas en tiempo real

### Acciones Rápidas

- Conectar/Desconectar cuenta ML
- Forzar sincronización masiva
- Reintentar productos fallidos
- Ver logs detallados

## 🎯 Best Practices

### Productos

1. **Mantener fuente de verdad local**: Editar siempre en el admin
2. **Usar SKUs consistentes**: Generar automáticamente si no existe
3. **Completar todos los atributos**: Mejora visibilidad en ML
4. **Respetar políticas de stock**: Evita rechazos

### Órdenes

1. **Importar automáticamente**: Via webhooks o polling
2. **Procesar en lotes**: Para mejorar performance
3. **Mantener trazabilidad**: Logs completos de cada paso

### Performance

1. **Rate limiting**: Respetar límites de ML (1000 req/hora)
2. **Batch operations**: Procesar en lotes de 20-50
3. **Cache**: Guardar tokens y datos de usuario
4. **Async**: Usar colas para operaciones pesadas

## 🔄 Flujo Recomendado

### Para Productos

1. Crear/editar en admin local
2. Configurar categoría ML y atributos
3. Definir stock y variantes
4. Sincronizar con ML
5. Monitorear estado y errores

### Para Ventas

1. Configurar webhooks en ML
2. Importar órdenes automáticamente
3. Descontar stock transaccionalmente
4. Actualizar estados en ML
5. Gestionar fulfillment local

## 📈 Próximos Pasos

1. **Publicaciones Masivas**: Crear/actualizar en lote
2. **Preguntas y Respuestas**: Gestionar desde el admin
3. **Reputación**: Sincronizar calificaciones
4. **Analytics**: Reportes avanzados de ML
5. **Multi-cuenta**: Soporte para múltiples cuentas

---

## 📞 Soporte

### Documentación ML

- [API Reference](https://api.mercadolibre.com/es/)
- [Product API](https://developers.mercadolibre.com/es/products-and-items)
- [Shipping API](https://developers.mercadolibre.com/es/shipping)

### Debug Info

Incluir siempre:

- App ID y Seller ID
- Item ID o Order ID
- Timestamp exacto
- Headers de respuesta
- Payload completo (sin datos sensibles)
