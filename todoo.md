# 🚀 TODO.md: Integración Completa Mercado Libre ↔ E-commerce

## 📋 Información del Proyecto
- **Framework**: Next.js 15 (App Router)
- **Base de Datos**: Neon Serverless Postgres con Drizzle ORM
- **App ID Mercado Libre**: 1591558006134773
- **Redirect URI**: https://prototype-ten-dun.vercel.app/
- **PKCE**: Habilitado
- **Webhook URL**: https://prototype-ten-dun.vercel.app/checkout/webhook

## 🔐 Scopes Mercado Libre Disponibles
- Usuarios: read/write
- Publicaciones: create, update, pause, delete
- Stock y precios
- Mensajes pre/post venta
- Ventas y envíos (CRÍTICO)
- Facturación
- Métricas del negocio
- Promociones
- Publicidad
- Acceso completo a la cuenta

---

## 🎯 MÓDULOS PRINCIPALES

### 1. 🔐 AUTENTICACIÓN OAUTH2 CON PKCE
**Prioridad: CRÍTICA** | **Estado: Pendiente**

#### Tareas Backend
- [X] **Implementar flujo OAuth2 PKCE**
  - **Descripción**: Crear endpoints para iniciar autenticación y manejar callback
  - **Pasos**:
    1. Generar code_verifier y code_challenge
    2. Redirigir a Mercado Libre con parámetros correctos
    3. Manejar callback y validar state
    4. Intercambiar code por access_token y refresh_token
  - **Riesgos**: Exposición de tokens, manejo incorrecto de PKCE
  - **Dependencias**: Ninguna
  - **Archivos**:
    - `app/api/auth/mercadolibre/route.ts` (nuevo)
    - `app/api/auth/mercadolibre/callback/route.ts` (nuevo)
    - `lib/auth/mercadolibre.ts` (nuevo - utilidades OAuth)
  - **Comentarios**: Crear directorio `app/api/auth/mercadolibre/`

- [X] **Gestión de tokens y refresh**
  - **Descripción**: Implementar renovación automática de tokens
  - **Pasos**:
    1. Almacenar tokens en BD con expiración
    2. Endpoint para refresh automático
    3. Middleware para validar tokens en requests
  - **Riesgos**: Tokens expirados causando fallos en API calls
  - **Dependencias**: Flujo OAuth2 básico
  - **Archivos**:
    - `lib/auth/mercadolibre.ts` (extender)
    - `lib/middleware/mercadolibre-auth.ts` (nuevo)

- [X] **Validación de scopes y permisos**
  - **Descripción**: Verificar que la app tenga los scopes necesarios
  - **Pasos**:
    1. Endpoint para verificar permisos activos
    2. UI para mostrar estado de permisos
    3. Alertas cuando falten permisos
  - **Riesgos**: Funcionalidades fallando por falta de permisos
  - **Dependencias**: Autenticación básica
  - **Archivos**:
    - `app/api/auth/mercadolibre/permissions/route.ts` (nuevo)
    - `components/admin/MercadoLibrePermissions.tsx` (nuevo)

#### Tareas Frontend
- [ ] **UI de conexión Mercado Libre**
  - **Descripción**: Botón y flujo para conectar cuenta ML
  - **Pasos**:
    1. Página de configuración ML en admin
    2. Estado de conexión (conectado/desconectado)
    3. Botón para iniciar OAuth flow
  - **Riesgos**: UX confusa para conectar cuenta
  - **Dependencias**: Backend OAuth
  - **Archivos**:
    - `app/admin/mercadolibre/page.tsx` (nuevo)
    - `components/admin/MercadoLibreConnection.tsx` (nuevo)

### 2. 📦 SINCRONIZACIÓN DE PRODUCTOS
**Prioridad: ALTA** | **Estado: Pendiente**

#### Tareas Backend
- [ ] **API para crear publicaciones ML**
  - **Descripción**: Convertir productos locales a formato ML
  - **Pasos**:
    1. Mapear campos (title, price, description, etc.)
    2. Subir imágenes a ML
    3. Crear publicación con POST /items
    4. Almacenar item_id de ML en BD local
  - **Riesgos**: Errores en mapeo causando publicaciones inválidas
  - **Dependencias**: Autenticación OAuth
  - **Archivos**:
    - `lib/services/mercadolibre/products.ts` (nuevo)
    - `app/api/mercadolibre/products/route.ts` (nuevo)
  - **Comentarios**: Usar endpoint https://api.mercadolibre.com/items

- [ ] **Sincronización bidireccional productos**
  - **Descripción**: Sync cambios entre local y ML
  - **Pasos**:
    1. Webhook para cambios en ML
    2. Job para sync cambios locales a ML
    3. Resolver conflictos (último modificado gana)
  - **Riesgos**: Loops infinitos de sync, pérdida de datos
  - **Dependencias**: API básica de productos
  - **Archivos**:
    - `app/api/webhooks/mercadolibre/products/route.ts` (nuevo)
    - `lib/jobs/sync-products.ts` (nuevo)

- [ ] **Manejo de variantes y atributos**
  - **Descripción**: Mapear variantes locales a variations ML
  - **Pasos**:
    1. Crear variations en ML
    2. Sync stock por variante
    3. Manejar combinations
  - **Riesgos**: Variantes no mapeadas correctamente
  - **Dependencias**: Sync productos básico
  - **Archivos**:
    - `lib/services/mercadolibre/variations.ts` (nuevo)

#### Tareas Frontend
- [ ] **UI para publicar productos en ML**
  - **Descripción**: Botones en admin productos para sync
  - **Pasos**:
    1. Estado de sync por producto
    2. Botón "Publicar en ML"
    3. Progreso de publicación
  - **Riesgos**: Usuario confundido con estados
  - **Dependencias**: API productos ML
  - **Archivos**:
    - `components/admin/ProductMercadoLibreSync.tsx` (nuevo)

### 3. 📊 SINCRONIZACIÓN DE INVENTARIO
**Prioridad: ALTA** | **Estado: Pendiente**

#### Tareas Backend
- [ ] **Sync stock bidireccional**
  - **Descripción**: Mantener stock sincronizado
  - **Pasos**:
    1. Webhook para cambios de stock en ML
    2. API para actualizar stock en ML
    3. Job automático cada X minutos
  - **Riesgos**: Ventas con stock negativo
  - **Dependencias**: Sync productos
  - **Archivos**:
    - `lib/services/mercadolibre/inventory.ts` (nuevo)
    - `app/api/webhooks/mercadolibre/inventory/route.ts` (nuevo)
  - **Comentarios**: Usar PUT /items/{item_id}

- [ ] **Manejo de reservas de stock**
  - **Descripción**: Reservar stock durante checkout
  - **Pasos**:
    1. Reservar stock al crear orden
    2. Liberar si no se paga
    3. Sync reservas con ML
  - **Riesgos**: Overbooking
  - **Dependencias**: Sistema de órdenes
  - **Archivos**:
    - `lib/services/mercadolibre/stock-reservation.ts` (nuevo)

### 4. 💰 SINCRONIZACIÓN DE PRECIOS
**Prioridad: MEDIA** | **Estado: Pendiente**

#### Tareas Backend
- [ ] **Sync precios automáticos**
  - **Descripción**: Actualizar precios en ML
  - **Pasos**:
    1. API para actualizar precios
    2. Job para sync masivo
    3. Validación de cambios permitidos
  - **Riesgos**: Precios incorrectos publicados
  - **Dependencias**: Sync productos
  - **Archivos**:
    - `lib/services/mercadolibre/pricing.ts` (nuevo)
  - **Comentarios**: Usar PUT /items/{item_id} con campo price

### 5. 🖼️ SINCRONIZACIÓN DE IMÁGENES
**Prioridad: MEDIA** | **Estado: Pendiente**

#### Tareas Backend
- [ ] **Upload imágenes a ML**
  - **Descripción**: Subir imágenes del producto a ML
  - **Pasos**:
    1. API para upload imágenes
    2. Procesar y optimizar imágenes
    3. Asociar a publicaciones
  - **Riesgos**: Imágenes no cargan, formato inválido
  - **Dependencias**: Sync productos
  - **Archivos**:
    - `lib/services/mercadolibre/images.ts` (nuevo)
  - **Comentarios**: Usar POST /pictures con multipart/form-data

### 6. 📋 SINCRONIZACIÓN DE ÓRDENES
**Prioridad: CRÍTICA** | **Estado: Pendiente**

#### Tareas Backend
- [ ] **Importar órdenes de ML**
  - **Descripción**: Crear órdenes locales desde ML
  - **Pasos**:
    1. Webhook para nuevas órdenes ML
    2. Mapear datos de orden ML
    3. Crear orden local con estado correcto
  - **Riesgos**: Órdenes duplicadas, datos mal mapeados
  - **Dependencias**: Sistema de órdenes local
  - **Archivos**:
    - `app/api/webhooks/mercadolibre/orders/route.ts` (nuevo)
    - `lib/services/mercadolibre/orders.ts` (nuevo)
  - **Comentarios**: Usar GET /orders/{order_id}

- [ ] **Sync estados de órdenes**
  - **Descripción**: Mantener estados sincronizados
  - **Pasos**:
    1. Webhook para cambios de estado en ML
    2. Actualizar estado local según ML
    3. Manejar transiciones de estado
  - **Riesgos**: Estados inconsistentes
  - **Dependencias**: Importar órdenes
  - **Archivos**:
    - `lib/services/mercadolibre/order-status.ts` (nuevo)

### 7. 💬 SINCRONIZACIÓN DE MENSAJES
**Prioridad: MEDIA** | **Estado: Pendiente**

#### Tareas Backend
- [ ] **API para mensajes ML**
  - **Descripción**: Enviar/recibir mensajes
  - **Pasos**:
    1. Webhook para nuevos mensajes
    2. API para enviar mensajes
    3. Almacenar conversación local
  - **Riesgos**: Mensajes no entregados
  - **Dependencias**: Sistema de órdenes
  - **Archivos**:
    - `lib/services/mercadolibre/messages.ts` (nuevo)
    - `app/api/webhooks/mercadolibre/messages/route.ts` (nuevo)
  - **Comentarios**: Usar POST /messages con pack_id

#### Tareas Frontend
- [ ] **UI para mensajes**
  - **Descripción**: Interfaz para ver/enviar mensajes
  - **Pasos**:
    1. Página de mensajes por orden
    2. Notificaciones de nuevos mensajes
    3. Historial de conversación
  - **Riesgos**: UX pobre para comunicación
  - **Dependencias**: API mensajes
  - **Archivos**:
    - `app/admin/orders/[id]/messages/page.tsx` (nuevo)
    - `components/admin/MessageThread.tsx` (nuevo)

### 8. ⭐ SINCRONIZACIÓN DE REPUTACIÓN/MÉTRICAS
**Prioridad: BAJA** | **Estado: Pendiente**

#### Tareas Backend
- [ ] **API para métricas ML**
  - **Descripción**: Obtener métricas de ventas/reputación
  - **Pasos**:
    1. Endpoints para obtener métricas
    2. Job para actualizar métricas locales
    3. Dashboard con métricas ML
  - **Riesgos**: Datos desactualizados
  - **Dependencias**: Autenticación
  - **Archivos**:
    - `lib/services/mercadolibre/metrics.ts` (nuevo)
    - `app/api/mercadolibre/metrics/route.ts` (nuevo)

### 9. 🔔 SISTEMA DE WEBHOOKS
**Prioridad: CRÍTICA** | **Estado: Pendiente**

#### Tareas Backend
- [ ] **Configurar webhooks en ML**
  - **Descripción**: Registrar webhook URL en ML
  - **Pasos**:
    1. API para crear webhook
    2. Verificar URL reachable
    3. Manejar eventos: orders, messages, shipments
  - **Riesgos**: Webhooks no llegan, URL incorrecta
  - **Dependencias**: Autenticación
  - **Archivos**:
    - `lib/services/mercadolibre/webhooks.ts` (nuevo)
    - `app/api/mercadolibre/webhooks/route.ts` (nuevo)
  - **Comentarios**: Usar PUT /applications/{app_id} para configurar topics

- [ ] **Procesamiento de webhooks**
  - **Descripción**: Manejar eventos entrantes
  - **Pasos**:
    1. Validar firma de webhook
    2. Routing por tipo de evento
    3. Queue para procesamiento asíncrono
  - **Riesgos**: Eventos procesados múltiples veces
  - **Dependencias**: Configuración webhooks
  - **Archivos**:
    - `app/api/webhooks/mercadolibre/route.ts` (nuevo)
    - `lib/queue/webhook-processor.ts` (nuevo)

### 10. 🚚 ELIMINACIÓN Y REEMPLAZO DEL SISTEMA DE ENVÍOS
**Prioridad: CRÍTICA** | **Estado: Pendiente**

#### Tareas de Eliminación
- [ ] **Eliminar modelo shipping_methods**
  - **Descripción**: Remover tabla y referencias
  - **Pasos**:
    1. Crear migración para eliminar tabla
    2. Remover referencias en schema.ts
    3. Actualizar queries que usen shipping_methods
  - **Riesgos**: Pérdida de datos históricos
  - **Dependencias**: Ninguna
  - **Archivos**:
    - `drizzle/migrations/eliminar-shipping-methods.sql` (nuevo)
    - `lib/schema.ts` (modificar)
  - **Comentarios Windsurf**: Backup de datos antes de eliminar

- [ ] **Eliminar shipping logic en checkout**
  - **Descripción**: Remover cálculo de envíos propios
  - **Pasos**:
    1. Remover cálculo de shipping cost
    2. Remover selección de shipping method
    3. Adaptar total calculation
  - **Riesgos**: Checkout roto
  - **Dependencias**: Ninguna
  - **Archivos**:
    - `app/api/checkout/route.ts` (modificar)
    - `components/checkout/ShippingForm.tsx` (eliminar)
    - `components/checkout/ShippingMethodSelector.tsx` (eliminar)

- [ ] **Eliminar shipping utilities**
  - **Descripción**: Remover funciones de cálculo de envíos
  - **Pasos**:
    1. Eliminar lib/utils/shipping.ts
    2. Remover referencias en código
  - **Riesgos**: Funciones huérfanas
  - **Dependencias**: Eliminación de shipping methods
  - **Archivos**:
    - `lib/utils/shipping.ts` (eliminar)

- [ ] **Eliminar shipping API routes**
  - **Descripción**: Remover endpoints de shipping
  - **Pasos**:
    1. Eliminar app/api/shipping-methods/
    2. Remover referencias en código
  - **Riesgos**: 404 en rutas existentes
  - **Dependencias**: Eliminación de shipping logic
  - **Archivos**:
    - `app/api/shipping-methods/` (eliminar)

- [ ] **Eliminar shipping fields de orders**
  - **Descripción**: Remover campos relacionados con envíos
  - **Pasos**:
    1. Migración para eliminar campos
    2. Actualizar queries y tipos
  - **Riesgos**: Datos perdidos
  - **Dependencias**: Eliminación de shipping methods
  - **Archivos**:
    - `lib/schema.ts` (modificar)
    - `drizzle/migrations/eliminar-campos-shipping-orders.sql` (nuevo)

#### Tareas de Nuevo Sistema de Envíos ML
- [ ] **Crear tabla meli_shipments**
  - **Descripción**: Modelo para shipments de ML
  - **Pasos**:
    1. Definir schema con estados ML
    2. Migración para crear tabla
    3. Relación con orders
  - **Riesgos**: Schema incorrecto
  - **Dependencias**: Eliminación sistema anterior
  - **Archivos**:
    - `lib/schema.ts` (agregar meli_shipments)
    - `drizzle/migrations/crear-meli-shipments.sql` (nuevo)
  - **Comentarios**: Estados: pending, ready_to_ship, shipped, delivered, not_delivered, cancelled

- [ ] **API para shipments ML**
  - **Descripción**: Interactuar con shipments API
  - **Pasos**:
    1. GET /shipments/{id}
    2. POST /shipments/{id}/tracking
    3. Gestión de etiquetas
  - **Riesgos**: Errores en API calls
  - **Dependencias**: Tabla meli_shipments
  - **Archivos**:
    - `lib/services/mercadolibre/shipments.ts` (nuevo)
    - `app/api/mercadolibre/shipments/[id]/route.ts` (nuevo)
  - **Comentarios**: Usar https://developers.mercadolibre.com.ar/devsite/manage-shipments

- [ ] **Webhooks para shipments**
  - **Descripción**: Procesar cambios en shipments
  - **Pasos**:
    1. Webhook para shipment updates
    2. Actualizar estado local
    3. Notificar cambios al usuario
  - **Riesgos**: Estados no actualizados
  - **Dependencias**: API shipments
  - **Archivos**:
    - `app/api/webhooks/mercadolibre/shipments/route.ts` (nuevo)

- [ ] **Integración con checkout**
  - **Descripción**: Adaptar checkout para ML shipments
  - **Pasos**:
    1. No calcular envíos propios
    2. Leer costos/estimaciones de ML
    3. Mostrar tracking real
  - **Riesgos**: Checkout sin costos de envío
  - **Dependencias**: Nuevo sistema shipments
  - **Archivos**:
    - `app/api/checkout/route.ts` (modificar)
    - `components/checkout/CheckoutSummary.tsx` (modificar)

- [ ] **UI para tracking de envíos**
  - **Descripción**: Mostrar estado real del envío
  - **Pasos**:
    1. Componente para mostrar shipment status
    2. Tracking number real
    3. Estimaciones de entrega
  - **Riesgos**: Información confusa
  - **Dependencias**: API shipments
  - **Archivos**:
    - `components/orders/ShipmentTracking.tsx` (nuevo)

---

## 🗄️ BASE DE DATOS

### Migraciones SQL Sugeridas
- [ ] **Agregar campos Mercado Libre a users**
  - ```sql
    ALTER TABLE users ADD COLUMN mercado_libre_id VARCHAR(100);
    ALTER TABLE users ADD COLUMN mercado_libre_access_token TEXT;
    ALTER TABLE users ADD COLUMN mercado_libre_refresh_token TEXT;
    ```

- [ ] **Crear tabla meli_shipments**
  - ```sql
    CREATE TABLE meli_shipments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id),
      meli_shipment_id BIGINT UNIQUE NOT NULL,
      status VARCHAR(50) NOT NULL, -- pending, ready_to_ship, shipped, delivered, not_delivered, cancelled
      substatus VARCHAR(100),
      logistic_mode VARCHAR(50), -- me1, me2, fulfillment, custom
      tracking_number VARCHAR(255),
      tracking_url TEXT,
      estimated_delivery DATE,
      shipped_at TIMESTAMP,
      delivered_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    ```

- [ ] **Agregar campos Mercado Libre a products**
  - ```sql
    ALTER TABLE products ADD COLUMN meli_item_id VARCHAR(100);
    ALTER TABLE products ADD COLUMN meli_listing_type VARCHAR(50);
    ALTER TABLE products ADD COLUMN meli_permalink TEXT;
    ```

---

## 🔒 SEGURIDAD
- [ ] **Validación de webhooks**: Implementar verificación de firma HMAC
- [ ] **Rate limiting**: Para APIs de Mercado Libre
- [ ] **Logging**: De todas las interacciones con ML
- [ ] **Backup**: De tokens y configuraciones críticas

---

## 🧪 TESTING
- [ ] **Unit tests**: Para servicios ML
- [ ] **Integration tests**: Para flujos completos
- [ ] **Webhook tests**: Simular eventos ML
- [ ] **E2E tests**: Flujos de compra con ML

---

## 📊 MONITOREO Y LOGGING
- [ ] **Dashboard de sync**: Estado de sincronizaciones
- [ ] **Alertas**: Para fallos en sync o webhooks
- [ ] **Logs detallados**: De API calls a ML
- [ ] **Métricas**: Tasa de éxito de operaciones

---

## 🚀 DEPLOYMENT Y CI/CD
- [ ] **Variables de entorno**: Configurar secrets para ML
- [ ] **Health checks**: Para servicios ML
- [ ] **Rollback plan**: Para revertir cambios críticos
- [ ] **Documentación**: De APIs y procesos

---

## ⚠️ RIESGOS CRÍTICOS
1. **Pérdida de datos**: Durante eliminación del sistema de envíos
2. **Inconsistencias**: Entre estados local y ML
3. **Rate limits**: Exceder límites de API ML
4. **Dependencias circulares**: En sync bidireccional
5. **Experiencia de usuario**: Durante transiciones

---

## 📚 REFERENCIAS A DOCUMENTACIÓN
- **OAuth2**: https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion
- **Shipments**: https://developers.mercadolibre.com.ar/devsite/manage-shipments
- **Items API**: https://developers.mercadolibre.com.ar/devsite/create-item
- **Webhooks**: https://developers.mercadolibre.com.ar/devsite/webhooks

---

## 🎯 SIGUIENTES PASOS RECOMENDADOS
1. Comenzar con autenticación OAuth2
2. Implementar eliminación del sistema de envíos
3. Crear base para shipments ML
4. Desarrollar sync de productos
5. Implementar webhooks
6. Testing exhaustivo
7. Deploy gradual con feature flags
