# 🚀 Plan de Migración: Mercado Libre ↔ E-commerce + Mercado Pago Checkout

## 📋 Información del Proyecto
- **Framework**: Next.js 15 (App Router)
- **Base de Datos**: Neon Serverless Postgres con Drizzle ORM
- **App ID Mercado Libre**: 8458968436453153
- **Estado Actual**: 85% de infraestructura reutilizable

---

## 🎯 ANÁLISIS DE ESTADO ACTUAL

### ✅ Componentes Ya Implementados
- **Autenticación ML**: `lib/auth/mercadolibre.ts` (100% funcional)
- **Webhooks MP**: `app/api/webhooks/mercadopago/route.ts` (operativo)
- **Validaciones**: `lib/validations/mercadolibre.ts` (esquemas Zod completos)
- **Componentes UI**: Admin ML ya implementados
- **Manejo de errores**: `lib/errors/mercadolibre-errors.ts`

### 📊 Estructura de BD Actual Reutilizable
- **`users`**: Campos ML OAuth ya existentes
- **`products`**: Estructura sólida con atributos dinámicos
- **`orders`**: Soporte básico para Mercado Pago
- **`categories`**: Compatible con ML
- **`stockLogs`**: Auditoría implementada
- **`productVariants`**: Soporte completo

---

## 📅 PLAN DE MIGRACIÓN DETALLADO

### 🏁 FASE 0: Preparación de Base de Datos (Día 1)
**Prioridad: CRÍTICA** | **Duración: 4-6 horas**

#### 0.1 Crear Migration de Drizzle
```bash
# Generar nueva migración
npx drizzle-kit generate --name=mercadolibre_integration
```

#### 0.2 Archivo: `drizzle/0001_mercadolibre_integration.sql`

```sql
-- ========================================
-- EXTENSIONES TABLAS EXISTENTES
-- ========================================

-- Extender tabla products para Mercado Libre
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_item_id TEXT UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_category_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_listing_type_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_condition TEXT DEFAULT 'new';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_buying_mode TEXT DEFAULT 'buy_it_now';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_currency_id TEXT DEFAULT 'ARS';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_sync_status TEXT DEFAULT 'pending';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_last_sync TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_permalink TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_thumbnail TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ml_video_id TEXT;

-- Extender tabla orders para Mercado Libre
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ml_order_id TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'local' CHECK (source IN ('local', 'mercadolibre', 'mercadopago'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ml_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ml_buyer_info JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ml_shipping_info JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ml_payment_info JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ml_feedback JSONB;

-- Mejorar tabla users para más scopes de ML
ALTER TABLE users ADD COLUMN IF NOT EXISTS ml_nickname TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ml_site_id TEXT DEFAULT 'MLA';
ALTER TABLE users ADD COLUMN IF NOT EXISTS ml_seller_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ml_permalink TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ml_level_id TEXT;

-- ========================================
-- NUEVAS TABLAS ESPECÍFICAS
-- ========================================

-- Tabla de sincronización de productos ML
CREATE TABLE IF NOT EXISTS mercadolibre_products_sync (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  ml_item_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error', 'conflict')),
  last_sync_at TIMESTAMP,
  sync_error TEXT,
  ml_data JSONB, -- Datos completos del item en ML
  sync_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de importación de órdenes ML
CREATE TABLE IF NOT EXISTS mercadolibre_orders_import (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  ml_order_id TEXT UNIQUE,
  import_status TEXT DEFAULT 'pending' CHECK (import_status IN ('pending', 'imported', 'error')),
  imported_at TIMESTAMP,
  import_error TEXT,
  ml_order_data JSONB, -- Datos completos de la orden ML
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de preguntas ML
CREATE TABLE IF NOT EXISTS mercadolibre_questions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  ml_question_id TEXT UNIQUE,
  ml_item_id TEXT,
  question_text TEXT NOT NULL,
  answer_text TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed', 'deleted')),
  ml_buyer_id TEXT,
  ml_buyer_nickname TEXT,
  question_date TIMESTAMP,
  answer_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhooks de Mercado Libre
CREATE TABLE IF NOT EXISTS mercadolibre_webhooks (
  id SERIAL PRIMARY KEY,
  webhook_id TEXT UNIQUE,
  topic TEXT NOT NULL, -- 'items', 'orders', 'questions', etc.
  resource TEXT, -- ID del recurso afectado
  user_id INTEGER REFERENCES users(id),
  resource_id TEXT,
  application_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Preferencias de Mercado Pago (mejorado)
CREATE TABLE IF NOT EXISTS mercadopago_preferences (
  id SERIAL PRIMARY KEY,
  preference_id TEXT UNIQUE,
  external_reference TEXT UNIQUE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id),
  init_point TEXT,
  sandbox_init_point TEXT,
  items JSONB NOT NULL,
  payer JSONB,
  payment_methods JSONB,
  expires BOOLEAN DEFAULT FALSE,
  expiration_date_from TIMESTAMP,
  expiration_date_to TIMESTAMP,
  notification_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'expired', 'active')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pagos de Mercado Pago (mejorado)
CREATE TABLE IF NOT EXISTS mercadopago_payments (
  id SERIAL PRIMARY KEY,
  payment_id TEXT UNIQUE,
  preference_id TEXT REFERENCES mercadopago_preferences(preference_id),
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  status TEXT,
  payment_method_id TEXT,
  payment_method_type TEXT,
  payment_method_name TEXT,
  amount DECIMAL(10,2),
  currency_id TEXT DEFAULT 'ARS',
  installments INTEGER,
  issuer_id TEXT,
  description TEXT,
  external_reference TEXT,
  statement_descriptor TEXT,
  date_created TIMESTAMP,
  date_approved TIMESTAMP,
  date_last_updated TIMESTAMP,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Métricas de integración
CREATE TABLE IF NOT EXISTS integration_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mercadolibre', 'mercadopago')),
  metric_name TEXT NOT NULL,
  metric_value INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ========================================

CREATE INDEX IF NOT EXISTS idx_products_ml_item_id ON products(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_products_ml_sync_status ON products(ml_sync_status);
CREATE INDEX IF NOT EXISTS idx_orders_ml_order_id ON orders(ml_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_users_ml_nickname ON users(ml_nickname);
CREATE INDEX IF NOT EXISTS idx_ml_sync_product_id ON mercadolibre_products_sync(product_id);
CREATE INDEX IF NOT EXISTS idx_ml_sync_ml_item_id ON mercadolibre_products_sync(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_ml_sync_status ON mercadolibre_products_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_ml_import_order_id ON mercadolibre_orders_import(order_id);
CREATE INDEX IF NOT EXISTS idx_ml_import_ml_order_id ON mercadolibre_orders_import(ml_order_id);
CREATE INDEX IF NOT EXISTS idx_ml_questions_product_id ON mercadolibre_questions(product_id);
CREATE INDEX IF NOT EXISTS idx_ml_questions_ml_item_id ON mercadolibre_questions(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_ml_questions_status ON mercadolibre_questions(status);
CREATE INDEX IF NOT EXISTS idx_ml_webhooks_processed ON mercadolibre_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_ml_webhooks_topic ON mercadolibre_webhooks(topic);
CREATE INDEX IF NOT EXISTS idx_ml_webhooks_created_at ON mercadolibre_webhooks(created_at);
CREATE INDEX IF NOT EXISTS idx_mp_preferences_external_reference ON mercadopago_preferences(external_reference);
CREATE INDEX IF NOT EXISTS idx_mp_preferences_order_id ON mercadopago_preferences(order_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_preference_id ON mercadopago_payments(preference_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_order_id ON mercadopago_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_date_platform ON integration_metrics(date, platform);
```

#### 0.3 Actualizar Archivo: `lib/schema.ts`

```typescript
// Agregar al final del archivo existente

// ======================
// Extensiones para Mercado Libre
// ======================

// Enums para estados de sincronización
export const syncStatusEnum = pgEnum("sync_status", [
  "pending",
  "syncing", 
  "synced",
  "error",
  "conflict"
]);

export const importStatusEnum = pgEnum("import_status", [
  "pending",
  "imported", 
  "error"
]);

export const questionStatusEnum = pgEnum("question_status", [
  "pending",
  "answered",
  "closed", 
  "deleted"
]);

export const orderSourceEnum = pgEnum("order_source", [
  "local",
  "mercadolibre",
  "mercadopago"
]);

export const preferenceStatusEnum = pgEnum("preference_status", [
  "pending",
  "expired",
  "active"
]);

// ======================
// Tabla de sincronización de productos ML
// ======================
export const mercadolibreProductsSync = pgTable("mercadolibre_products_sync", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  mlItemId: text("ml_item_id").unique(),
  syncStatus: syncStatusEnum("sync_status").default("pending").notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  mlData: jsonb("ml_data"),
  syncAttempts: integer("sync_attempts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ml_sync_product_id_idx").on(table.productId),
  index("ml_sync_ml_item_id_idx").on(table.mlItemId),
  index("ml_sync_status_idx").on(table.syncStatus),
]);

// ======================
// Tabla de importación de órdenes ML
// ======================
export const mercadolibreOrdersImport = pgTable("mercadolibre_orders_import", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  mlOrderId: text("ml_order_id").unique(),
  importStatus: importStatusEnum("import_status").default("pending").notNull(),
  importedAt: timestamp("imported_at"),
  importError: text("import_error"),
  mlOrderData: jsonb("ml_order_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ml_import_order_id_idx").on(table.orderId),
  index("ml_import_ml_order_id_idx").on(table.mlOrderId),
]);

// ======================
// Tabla de preguntas ML
// ======================
export const mercadolibreQuestions = pgTable("mercadolibre_questions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  mlQuestionId: text("ml_question_id").unique(),
  mlItemId: text("ml_item_id"),
  questionText: text("question_text").notNull(),
  answerText: text("answer_text"),
  status: questionStatusEnum("status").default("pending").notNull(),
  mlBuyerId: text("ml_buyer_id"),
  mlBuyerNickname: text("ml_buyer_nickname"),
  questionDate: timestamp("question_date"),
  answerDate: timestamp("answer_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ml_questions_product_id_idx").on(table.productId),
  index("ml_questions_ml_item_id_idx").on(table.mlItemId),
  index("ml_questions_status_idx").on(table.status),
]);

// ======================
// Webhooks de Mercado Libre
// ======================
export const mercadolibreWebhooks = pgTable("mercadolibre_webhooks", {
  id: serial("id").primaryKey(),
  webhookId: text("webhook_id").unique(),
  topic: text("topic").notNull(),
  resource: text("resource"),
  userId: integer("user_id").references(() => users.id),
  resourceId: text("resource_id"),
  applicationId: text("application_id"),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").default(false).notNull(),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ml_webhooks_processed_idx").on(table.processed),
  index("ml_webhooks_topic_idx").on(table.topic),
  index("ml_webhooks_created_at_idx").on(table.createdAt),
]);

// ======================
// Preferencias de Mercado Pago
// ======================
export const mercadopagoPreferences = pgTable("mercadopago_preferences", {
  id: serial("id").primaryKey(),
  preferenceId: text("preference_id").unique(),
  externalReference: text("external_reference").unique(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  userId: integer("user_id").references(() => users.id),
  initPoint: text("init_point"),
  sandboxInitPoint: text("sandbox_init_point"),
  items: jsonb("items").notNull(),
  payer: jsonb("payer"),
  paymentMethods: jsonb("payment_methods"),
  expires: boolean("expires").default(false).notNull(),
  expirationDateFrom: timestamp("expiration_date_from"),
  expirationDateTo: timestamp("expiration_date_to"),
  notificationUrl: text("notification_url"),
  status: preferenceStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("mp_preferences_external_reference_idx").on(table.externalReference),
  index("mp_preferences_order_id_idx").on(table.orderId),
]);

// ======================
// Pagos de Mercado Pago
// ======================
export const mercadopagoPayments = pgTable("mercadopago_payments", {
  id: serial("id").primaryKey(),
  paymentId: text("payment_id").unique(),
  preferenceId: text("preference_id").references(() => mercadopagoPreferences.preferenceId),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  status: text("status"),
  paymentMethodId: text("payment_method_id"),
  paymentMethodType: text("payment_method_type"),
  paymentMethodName: text("payment_method_name"),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currencyId: text("currency_id").default("ARS"),
  installments: integer("installments"),
  issuerId: text("issuer_id"),
  description: text("description"),
  externalReference: text("external_reference"),
  statementDescriptor: text("statement_descriptor"),
  dateCreated: timestamp("date_created"),
  dateApproved: timestamp("date_approved"),
  dateLastUpdated: timestamp("date_last_updated"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("mp_payments_preference_id_idx").on(table.preferenceId),
  index("mp_payments_order_id_idx").on(table.orderId),
]);

// ======================
// Métricas de integración
// ======================
export const integrationMetrics = pgTable("integration_metrics", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  platform: text("platform").notNull(),
  metricName: text("metric_name").notNull(),
  metricValue: integer("metric_value").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("integration_metrics_date_platform_idx").on(table.date, table.platform),
]);

// ======================
// Tipos TypeScript para nuevas tablas
// ======================
export type MercadoLibreProductsSync = typeof mercadolibreProductsSync.$inferSelect;
export type NewMercadoLibreProductsSync = typeof mercadolibreProductsSync.$inferInsert;
export type MercadoLibreOrdersImport = typeof mercadolibreOrdersImport.$inferSelect;
export type NewMercadoLibreOrdersImport = typeof mercadolibreOrdersImport.$inferInsert;
export type MercadoLibreQuestion = typeof mercadolibreQuestions.$inferSelect;
export type NewMercadoLibreQuestion = typeof mercadolibreQuestions.$inferInsert;
export type MercadoLibreWebhook = typeof mercadolibreWebhooks.$inferSelect;
export type NewMercadoLibreWebhook = typeof mercadolibreWebhooks.$inferInsert;
export type MercadoPagoPreference = typeof mercadopagoPreferences.$inferSelect;
export type NewMercadoPagoPreference = typeof mercadopagoPreferences.$inferInsert;
export type MercadoPagoPayment = typeof mercadopagoPayments.$inferSelect;
export type NewMercadoPagoPayment = typeof mercadopagoPayments.$inferInsert;
export type IntegrationMetric = typeof integrationMetrics.$inferSelect;
export type NewIntegrationMetric = typeof integrationMetrics.$inferInsert;
```

#### 0.4 Ejecutar Migración
```bash
# Aplicar migración a la base de datos
npx drizzle-kit push
```

---

### 🔧 FASE 1: Extender Servicios Existentes (Día 2)
**Prioridad: ALTA** | **Duración: 6-8 horas**

#### 1.1 Actualizar: `lib/actions/products.ts`

```typescript
// Agregar funciones para Mercado Libre

import { db } from '@/lib/db';
import { products, mercadolibreProductsSync } from '@/lib/schema';
import { eq, and, desc } from 'drizzle-orm';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';

// Sincronizar producto con Mercado Libre
export async function syncProductToMercadoLibre(
  productId: number,
  userId: number
): Promise<{ success: boolean; mlItemId?: string; error?: string }> {
  try {
    // Obtener producto local
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      return { success: false, error: 'Producto no encontrado' };
    }

    // Actualizar estado de sincronización
    await db.update(mercadolibreProductsSync)
      .set({ 
        syncStatus: 'syncing',
        syncAttempts: sql`${mercadolibreProductsSync.syncAttempts} + 1`,
        updatedAt: new Date()
      })
      .where(eq(mercadolibreProductsSync.productId, productId));

    // Preparar datos para ML
    const mlProductData = {
      title: product.name,
      category_id: product.mlCategoryId || 'MLA3530', // Default categoría
      price: Number(product.price),
      currency_id: product.mlCurrencyId || 'ARS',
      available_quantity: product.stock,
      buying_mode: product.mlBuyingMode || 'buy_it_now',
      listing_type_id: product.mlListingTypeId || 'bronze',
      condition: product.mlCondition || 'new',
      description: product.description || '',
      pictures: product.images ? 
        (Array.isArray(product.images) ? product.images.map(img => ({ source: img })) : [{ source: product.image }]) :
        [{ source: product.image }].filter(img => img.source),
    };

    // Enviar a Mercado Libre
    const response = await makeAuthenticatedRequest(
      userId,
      '/items',
      {
        method: 'POST',
        body: JSON.stringify(mlProductData),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error creando producto en ML: ${error}`);
    }

    const mlItem = await response.json();
    const mlItemId = mlItem.id;

    // Actualizar producto local con ID de ML
    await db.update(products)
      .set({
        mlItemId,
        mlSyncStatus: 'synced',
        mlLastSync: new Date(),
        mlPermalink: mlItem.permalink,
        mlThumbnail: mlItem.thumbnail,
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));

    // Actualizar tabla de sincronización
    await db.update(mercadolibreProductsSync)
      .set({
        mlItemId,
        syncStatus: 'synced',
        lastSyncAt: new Date(),
        mlData: mlItem,
        updatedAt: new Date()
      })
      .where(eq(mercadolibreProductsSync.productId, productId));

    return { success: true, mlItemId };

  } catch (error) {
    console.error('Error sincronizando producto a ML:', error);
    
    // Actualizar estado de error
    await db.update(mercadolibreProductsSync)
      .set({
        syncStatus: 'error',
        syncError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date()
      })
      .where(eq(mercadolibreProductsSync.productId, productId));

    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Actualizar stock en Mercado Libre
export async function updateStockInMercadoLibre(
  productId: number,
  newStock: number,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product?.mlItemId) {
      return { success: false, error: 'Producto no sincronizado con ML' };
    }

    const response = await makeAuthenticatedRequest(
      userId,
      `/items/${product.mlItemId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          available_quantity: newStock,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error actualizando stock en ML: ${error}`);
    }

    // Actualizar timestamp de sincronización
    await db.update(products)
      .set({
        mlLastSync: new Date(),
        updatedAt: new Date()
      })
      .where(eq(products.id, productId));

    return { success: true };

  } catch (error) {
    console.error('Error actualizando stock en ML:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Obtener productos pendientes de sincronización
export async function getPendingSyncProducts(userId?: number) {
  return await db.query.products.findMany({
    where: and(
      eq(products.mlSyncStatus, 'pending'),
      userId ? eq(products.userId, userId) : undefined
    ),
    orderBy: desc(products.createdAt),
  });
}

// Crear registro de sincronización para producto
export async function createProductSyncRecord(productId: number) {
  const existing = await db.query.mercadolibreProductsSync.findFirst({
    where: eq(mercadolibreProductsSync.productId, productId),
  });

  if (!existing) {
    await db.insert(mercadolibreProductsSync).values({
      productId,
      syncStatus: 'pending',
    });
  }
}
```

#### 1.2 Actualizar: `lib/actions/orders.ts`

```typescript
// Agregar funciones para importación de órdenes ML

import { db } from '@/lib/db';
import { orders, mercadolibreOrdersImport, users, products, orderItems } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';

// Importar órdenes desde Mercado Libre
export async function importOrdersFromMercadoLibre(
  userId: number,
  limit: number = 50
): Promise<{ success: boolean; imported: number; error?: string }> {
  try {
    // Obtener órdenes recientes de ML
    const response = await makeAuthenticatedRequest(
      userId,
      `/orders/search?seller=${userId}&limit=${limit}&sort=date_desc`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error obteniendo órdenes de ML: ${error}`);
    }

    const mlOrdersResponse = await response.json();
    const mlOrders = mlOrdersResponse.results || [];

    let importedCount = 0;

    for (const mlOrder of mlOrders) {
      try {
        // Verificar si ya fue importada
        const existingImport = await db.query.mercadolibreOrdersImport.findFirst({
          where: eq(mercadolibreOrdersImport.mlOrderId, mlOrder.id.toString()),
        });

        if (existingImport) {
          continue; // Ya fue importada
        }

        // Crear orden local
        const newOrder = await db.insert(orders).values({
          userId,
          total: mlOrder.total_amount.toString(),
          status: mapMLStatusToLocal(mlOrder.status),
          mlOrderId: mlOrder.id.toString(),
          source: 'mercadolibre',
          mlStatus: mlOrder.status,
          mlBuyerInfo: JSON.stringify(mlOrder.buyer),
          mlShippingInfo: JSON.stringify(mlOrder.shipping),
          mlPaymentInfo: JSON.stringify(mlOrder.payments),
          createdAt: new Date(mlOrder.date_created),
          updatedAt: new Date(),
        }).returning({ id: orders.id });

        const orderId = newOrder[0].id;

        // Crear items de la orden
        if (mlOrder.order_items && mlOrder.order_items.length > 0) {
          const orderItemsData = [];

          for (const mlItem of mlOrder.order_items) {
            // Buscar producto local por ML item ID
            const localProduct = await db.query.products.findFirst({
              where: eq(products.mlItemId, mlItem.item.id.toString()),
            });

            if (localProduct) {
              orderItemsData.push({
                orderId,
                productId: localProduct.id,
                quantity: mlItem.quantity,
                price: mlItem.unit_price.toString(),
              });
            }
          }

          if (orderItemsData.length > 0) {
            await db.insert(orderItems).values(orderItemsData);
          }
        }

        // Crear registro de importación
        await db.insert(mercadolibreOrdersImport).values({
          orderId,
          mlOrderId: mlOrder.id.toString(),
          importStatus: 'imported',
          importedAt: new Date(),
          mlOrderData: mlOrder,
        });

        importedCount++;

      } catch (itemError) {
        console.error(`Error importando orden ${mlOrder.id}:`, itemError);
        
        // Guardar registro de error
        await db.insert(mercadolibreOrdersImport).values({
          orderId: null,
          mlOrderId: mlOrder.id.toString(),
          importStatus: 'error',
          importError: itemError instanceof Error ? itemError.message : String(itemError),
          mlOrderData: mlOrder,
        });
      }
    }

    return { success: true, imported: importedCount };

  } catch (error) {
    console.error('Error importando órdenes de ML:', error);
    return { 
      success: false, 
      imported: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Mapear estados de ML a locales
function mapMLStatusToLocal(mlStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'paid': 'paid',
    'cancelled': 'cancelled',
    'confirmed': 'paid',
    'payment_required': 'pending',
    'payment_in_process': 'pending',
    'partially_paid': 'paid',
    'rejected': 'rejected',
    'refunded': 'cancelled',
    'in_mediation': 'pending',
    'invalid': 'rejected',
  };

  return statusMap[mlStatus] || 'pending';
}

// Obtener órdenes pendientes de importación
export async function getPendingImportOrders() {
  return await db.query.mercadolibreOrdersImport.findMany({
    where: eq(mercadolibreOrdersImport.importStatus, 'pending'),
    orderBy: { createdAt: 'desc' },
  });
}
```

---

### 🌐 FASE 2: Crear Nuevos Endpoints API (Día 3)
**Prioridad: ALTA** | **Duración: 8 horas**

#### 2.1 Crear: `app/api/mercadolibre/products/sync/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { syncProductToMercadoLibre } from '@/lib/actions/products';

export async function POST(
  request: Request,
  { params }: { params: { productId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const productId = parseInt(params.productId);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 });
    }

    const result = await syncProductToMercadoLibre(productId, parseInt(session.user.id));

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        mlItemId: result.mlItemId,
        message: 'Producto sincronizado exitosamente'
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error en endpoint de sincronización:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
```

#### 2.2 Crear: `app/api/mercadolibre/orders/import/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { importOrdersFromMercadoLibre } from '@/lib/actions/orders';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const limit = body.limit || 50;

    const result = await importOrdersFromMercadoLibre(
      parseInt(session.user.id), 
      limit
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error importando órdenes:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
```

#### 2.3 Crear: `app/api/webhooks/mercadolibre/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mercadolibreWebhooks } from '@/lib/schema';
import { processMercadoLibreWebhook } from '@/lib/services/mercadolibre/webhooks';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const payload = JSON.parse(body);

    // Extraer información del webhook
    const webhookId = generateWebhookId();
    const topic = payload.topic || payload.type;
    const resource = payload.resource || payload.resource_id;
    const applicationId = payload.application_id;

    // Guardar webhook en BD
    const webhookRecord = await db.insert(mercadolibreWebhooks).values({
      webhookId,
      topic,
      resource,
      resourceId: extractResourceId(resource),
      applicationId,
      payload,
      processed: false,
    }).returning({ id: mercadolibreWebhooks.id });

    // Procesar webhook asíncronamente
    processMercadoLibreWebhook(webhookRecord[0].id).catch(error => {
      console.error('Error procesando webhook:', error);
    });

    return NextResponse.json({ success: true, webhookId });

  } catch (error) {
    console.error('Error recibiendo webhook ML:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

function generateWebhookId(): string {
  return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function extractResourceId(resource: string): string {
  if (!resource) return '';
  const parts = resource.split('/');
  return parts[parts.length - 1] || '';
}
```

---

### 🎨 FASE 3: Actualizar Componentes UI (Día 4)
**Prioridad: MEDIA** | **Duración: 6 horas**

#### 3.1 Actualizar: `components/admin/MercadoLibreConnection.tsx`

```typescript
// Agregar funcionalidad de sincronización

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sync, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface SyncStatus {
  total: number;
  synced: number;
  pending: number;
  errors: number;
}

export function MercadoLibreSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/mercadolibre/sync/status');
      const data = await response.json();
      setSyncStatus(data);
      setLastSync(data.lastSync ? new Date(data.lastSync) : null);
    } catch (error) {
      console.error('Error obteniendo estado de sincronización:', error);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/mercadolibre/sync/all', {
        method: 'POST',
      });
      const result = await response.json();
      
      if (result.success) {
        await fetchSyncStatus();
      }
    } catch (error) {
      console.error('Error en sincronización:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!syncStatus) {
    return <div>Cargando estado de sincronización...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sync className="h-5 w-5" />
          Estado de Sincronización
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{syncStatus.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{syncStatus.synced}</div>
            <div className="text-sm text-muted-foreground">Sincronizados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{syncStatus.pending}</div>
            <div className="text-sm text-muted-foreground">Pendientes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{syncStatus.errors}</div>
            <div className="text-sm text-muted-foreground">Errores</div>
          </div>
        </div>

        {lastSync && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Última sincronización: {lastSync.toLocaleString()}
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleSyncAll}
            disabled={isSyncing || syncStatus.pending === 0}
            className="flex-1"
          >
            {isSyncing ? (
              <>
                <Sync className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Sync className="h-4 w-4 mr-2" />
                Sincronizar Pendientes ({syncStatus.pending})
              </>
            )}
          </Button>
          
          <Button variant="outline" onClick={fetchSyncStatus}>
            Actualizar
          </Button>
        </div>

        {syncStatus.errors > 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-800">
              {syncStatus.errors} productos con errores de sincronización
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### 3.2 Crear: `components/admin/ProductSyncButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sync, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface ProductSyncButtonProps {
  productId: number;
  mlItemId?: string | null;
  syncStatus?: string;
  onSyncComplete?: () => void;
}

export function ProductSyncButton({
  productId,
  mlItemId,
  syncStatus,
  onSyncComplete
}: ProductSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/mercadolibre/products/${productId}/sync`, {
        method: 'POST',
      });
      const result = await response.json();
      
      if (result.success) {
        onSyncComplete?.();
      }
    } catch (error) {
      console.error('Error sincronizando producto:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'syncing':
        return <Sync className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Sync className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    const statusConfig = {
      synced: { label: 'Sincronizado', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
      error: { label: 'Error', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
      syncing: { label: 'Sincronizando', variant: 'secondary' as const, color: 'bg-blue-100 text-blue-800' },
      pending: { label: 'Pendiente', variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' },
    };

    const config = statusConfig[syncStatus as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant} className={config.color}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {getStatusIcon()}
      {getStatusBadge()}
      
      {!mlItemId ? (
        <Button
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <Sync className="h-4 w-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <Sync className="h-4 w-4 mr-2" />
              Sincronizar
            </>
          )}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`https://articulo.mercadolibre.com.ar/${mlItemId}`, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Ver en ML
        </Button>
      )}
    </div>
  );
}
```

---

### 🔍 FASE 4: Crear Servicios de Sincronización (Día 5)
**Prioridad: ALTA** | **Duración: 8 horas**

#### 4.1 Crear: `lib/services/mercadolibre/webhooks.ts`

```typescript
import { db } from '@/lib/db';
import { mercadolibreWebhooks, products, orders } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

export async function processMercadoLibreWebhook(webhookId: number) {
  try {
    // Obtener webhook de BD
    const webhook = await db.query.mercadolibreWebhooks.findFirst({
      where: eq(mercadolibreWebhooks.id, webhookId),
    });

    if (!webhook) {
      throw new Error(`Webhook ${webhookId} no encontrado`);
    }

    if (webhook.processed) {
      logger.info(`Webhook ${webhookId} ya procesado`);
      return;
    }

    const { topic, resource, payload } = webhook;

    logger.info('Procesando webhook ML', {
      webhookId,
      topic,
      resource,
      payload
    });

    // Procesar según el tipo de webhook
    switch (topic) {
      case 'items':
        await handleItemWebhook(payload);
        break;
      case 'orders':
        await handleOrderWebhook(payload);
        break;
      case 'questions':
        await handleQuestionWebhook(payload);
        break;
      case 'claims':
        await handleClaimWebhook(payload);
        break;
      default:
        logger.warn('Tipo de webhook no manejado', { topic });
    }

    // Marcar como procesado
    await db.update(mercadolibreWebhooks)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(eq(mercadolibreWebhooks.id, webhookId));

    logger.info('Webhook procesado exitosamente', { webhookId });

  } catch (error) {
    logger.error('Error procesando webhook', {
      webhookId,
      error: error instanceof Error ? error.message : String(error)
    });

    // Actualizar con error
    await db.update(mercadolibreWebhooks)
      .set({
        errorMessage: error instanceof Error ? error.message : String(error),
        retryCount: sql`${mercadolibreWebhooks.retryCount} + 1`,
      })
      .where(eq(mercadolibreWebhooks.id, webhookId));

    throw error;
  }
}

async function handleItemWebhook(payload: any) {
  const { item_id, status } = payload;

  if (!item_id) return;

  // Actualizar estado del producto local
  const product = await db.query.products.findFirst({
    where: eq(products.mlItemId, item_id.toString()),
  });

  if (product) {
    await db.update(products)
      .set({
        mlSyncStatus: status === 'active' ? 'synced' : 'error',
        updatedAt: new Date(),
      })
      .where(eq(products.id, product.id));

    logger.info('Producto actualizado desde webhook', {
      productId: product.id,
      mlItemId: item_id,
      status
    });
  }
}

async function handleOrderWebhook(payload: any) {
  const { order_id, status } = payload;

  if (!order_id) return;

  // Actualizar estado de orden local
  const order = await db.query.orders.findFirst({
    where: eq(orders.mlOrderId, order_id.toString()),
  });

  if (order) {
    await db.update(orders)
      .set({
        status: mapMLStatusToLocal(status),
        mlStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    logger.info('Orden actualizada desde webhook', {
      orderId: order.id,
      mlOrderId: order_id,
      status
    });
  }
}

async function handleQuestionWebhook(payload: any) {
  // Implementar manejo de preguntas
  logger.info('Pregunta recibida', payload);
}

async function handleClaimWebhook(payload: any) {
  // Implementar manejo de reclamos
  logger.info('Reclamo recibido', payload);
}

function mapMLStatusToLocal(mlStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'paid': 'paid',
    'cancelled': 'cancelled',
    'confirmed': 'paid',
    'payment_required': 'pending',
    'payment_in_process': 'pending',
    'partially_paid': 'paid',
    'rejected': 'rejected',
    'refunded': 'cancelled',
    'in_mediation': 'pending',
    'invalid': 'rejected',
  };

  return statusMap[mlStatus] || 'pending';
}
```

#### 4.2 Crear: `lib/services/mercadolibre/inventory.ts`

```typescript
import { db } from '@/lib/db';
import { products, mercadolibreProductsSync, stockLogs } from '@/lib/schema';
import { eq, and, desc } from 'drizzle-orm';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';

export async function syncInventoryToMercadoLibre(
  userId: number,
  productId?: number
): Promise<{ success: boolean; synced: number; errors: number }> {
  try {
    let synced = 0;
    let errors = 0;

    // Obtener productos para sincronizar
    const productsToSync = productId 
      ? await db.query.products.findMany({
          where: eq(products.id, productId),
        })
      : await db.query.products.findMany({
          where: and(
            eq(products.mlSyncStatus, 'synced'),
            eq(products.isActive, true)
          ),
        });

    logger.info('Iniciando sincronización de inventario', {
      userId,
      productCount: productsToSync.length
    });

    for (const product of productsToSync) {
      try {
        if (!product.mlItemId) {
          logger.warn('Producto sin ML item ID', { productId: product.id });
          continue;
        }

        // Obtener stock actual
        const currentStock = product.stock || 0;

        // Actualizar en Mercado Libre
        const response = await makeAuthenticatedRequest(
          userId,
          `/items/${product.mlItemId}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              available_quantity: currentStock,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Error actualizando stock en ML: ${error}`);
        }

        // Actualizar timestamp
        await db.update(products)
          .set({
            mlLastSync: new Date(),
            updatedAt: new Date()
          })
          .where(eq(products.id, product.id));

        synced++;

        logger.info('Stock sincronizado', {
          productId: product.id,
          mlItemId: product.mlItemId,
          stock: currentStock
        });

      } catch (error) {
        errors++;
        logger.error('Error sincronizando stock de producto', {
          productId: product.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { success: true, synced, errors };

  } catch (error) {
    logger.error('Error en sincronización de inventario', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return { success: false, synced: 0, errors: 0 };
  }
}

export async function bidirectionalInventorySync(
  userId: number,
  productId: number
): Promise<{ success: boolean; source: 'local' | 'ml'; error?: string }> {
  try {
    // Obtener producto local
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product?.mlItemId) {
      return { success: false, error: 'Producto no sincronizado con ML' };
    }

    // Obtener stock desde Mercado Libre
    const response = await makeAuthenticatedRequest(
      userId,
      `/items/${product.mlItemId}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error obteniendo stock de ML: ${error}`);
    }

    const mlItem = await response.json();
    const mlStock = mlItem.available_quantity || 0;
    const localStock = product.stock || 0;

    // Comparar stocks
    if (localStock !== mlStock) {
      logger.warn('Diferencia de stock detectada', {
        productId,
        localStock,
        mlStock,
        mlItemId: product.mlItemId
      });

      // Estrategia: usar el stock más bajo para evitar sobreventa
      const newStock = Math.min(localStock, mlStock);

      // Actualizar local
      await db.update(products)
        .set({
          stock: newStock,
          updatedAt: new Date()
        })
        .where(eq(products.id, productId));

      // Crear log de ajuste
      await db.insert(stockLogs).values({
        productId,
        oldStock: localStock,
        newStock,
        change: newStock - localStock,
        reason: 'Sincronización bidireccional ML',
        userId,
      });

      // Actualizar en ML si el stock local es menor
      if (localStock < mlStock) {
        await makeAuthenticatedRequest(
          userId,
          `/items/${product.mlItemId}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              available_quantity: localStock,
            }),
          }
        );

        return { success: true, source: 'local' };
      } else {
        return { success: true, source: 'ml' };
      }
    }

    return { success: true, source: 'local' };

  } catch (error) {
    logger.error('Error en sincronización bidireccional', {
      productId,
      error: error instanceof Error ? error.message : String(error)
    });
    return { 
      success: false, 
      source: 'local',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

---

### 📊 FASE 5: Monitoreo y Métricas (Día 6)
**Prioridad: MEDIA** | **Duración: 4 horas**

#### 5.1 Crear: `lib/services/metrics.ts`

```typescript
import { db } from '@/lib/db';
import { integrationMetrics } from '@/lib/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export async function recordIntegrationMetric(
  platform: 'mercadolibre' | 'mercadopago',
  metricName: string,
  value: number,
  metadata?: any
) {
  await db.insert(integrationMetrics).values({
    date: new Date(),
    platform,
    metricName,
    metricValue: value,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

export async function getIntegrationMetrics(
  platform: 'mercadolibre' | 'mercadopago',
  metricName: string,
  startDate: Date,
  endDate: Date
) {
  return await db.query.integrationMetrics.findMany({
    where: and(
      eq(integrationMetrics.platform, platform),
      eq(integrationMetrics.metricName, metricName),
      gte(integrationMetrics.date, startDate),
      lte(integrationMetrics.date, endDate)
    ),
    orderBy: { date: 'desc' },
  });
}

export async function getDailyMetricsSummary(date: Date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const metrics = await db.query.integrationMetrics.findMany({
    where: and(
      gte(integrationMetrics.date, startOfDay),
      lte(integrationMetrics.date, endOfDay)
    ),
  });

  // Agrupar por plataforma y métrica
  const summary: Record<string, Record<string, number>> = {};
  
  for (const metric of metrics) {
    if (!summary[metric.platform]) {
      summary[metric.platform] = {};
    }
    
    if (!summary[metric.platform][metric.metricName]) {
      summary[metric.platform][metric.metricName] = 0;
    }
    
    summary[metric.platform][metric.metricName] += metric.metricValue;
  }

  return summary;
}

// Métricas específicas para Mercado Libre
export async function recordMercadoLibreMetrics(userId: number) {
  try {
    // Contar productos sincronizados
    const syncedProducts = await db.query.products.findMany({
      where: eq(products.mlSyncStatus, 'synced'),
    });

    // Contar productos pendientes
    const pendingProducts = await db.query.products.findMany({
      where: eq(products.mlSyncStatus, 'pending'),
    });

    // Contar productos con errores
    const errorProducts = await db.query.products.findMany({
      where: eq(products.mlSyncStatus, 'error'),
    });

    const date = new Date();
    
    await Promise.all([
      recordIntegrationMetric('mercadolibre', 'products_synced', syncedProducts.length, { userId }),
      recordIntegrationMetric('mercadolibre', 'products_pending', pendingProducts.length, { userId }),
      recordIntegrationMetric('mercadolibre', 'products_error', errorProducts.length, { userId }),
    ]);

  } catch (error) {
    console.error('Error registrando métricas ML:', error);
  }
}
```

#### 5.2 Crear: `app/api/admin/metrics/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDailyMetricsSummary } from '@/lib/services/metrics';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    const targetDate = date ? new Date(date) : new Date();
    const metrics = await getDailyMetricsSummary(targetDate);

    return NextResponse.json({
      date: targetDate,
      metrics,
    });

  } catch (error) {
    console.error('Error obteniendo métricas:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
```

---

## 🧪 FASE 6: Testing y Validación (Día 7)
**Prioridad: CRÍTICA** | **Duración: 6 horas**

### 6.1 Crear Tests de Integración

```typescript
// tests/integration/mercadolibre.test.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { syncProductToMercadoLibre } from '@/lib/actions/products';
import { importOrdersFromMercadoLibre } from '@/lib/actions/orders';
import { processMercadoLibreWebhook } from '@/lib/services/mercadolibre/webhooks';

describe('Integración Mercado Libre', () => {
  beforeEach(() => {
    // Limpiar BD de测试
  });

  it('debe sincronizar producto a Mercado Libre', async () => {
    const result = await syncProductToMercadoLibre(1, 1);
    
    expect(result.success).toBe(true);
    expect(result.mlItemId).toBeDefined();
  });

  it('debe importar órdenes desde Mercado Libre', async () => {
    const result = await importOrdersFromMercadoLibre(1, 10);
    
    expect(result.success).toBe(true);
    expect(result.imported).toBeGreaterThanOrEqual(0);
  });

  it('debe procesar webhook de item', async () => {
    const webhookPayload = {
      topic: 'items',
      resource: '/items/MLA123456789',
      user_id: '123456789',
      application_id: '8458968436453153',
      item_id: 'MLA123456789',
      status: 'active'
    };

    // Simular recepción de webhook
    const result = await processMercadoLibreWebhook(1);
    
    expect(result).toBeDefined();
  });
});
```

### 6.2 Checklist de Validación

```markdown
## ✅ Checklist de Validación Final

### Base de Datos
- [ ] Migración aplicada exitosamente
- [ ] Nuevas tablas creadas
- [ ] Índices generados
- [ ] Datos existentes preservados

### Autenticación
- [ ] OAuth ML funciona correctamente
- [ ] Tokens se guardan y refrescan
- [ ] Scopes validados correctamente

### Sincronización Productos
- [ ] Productos se publican en ML
- [ ] Stock se actualiza bidireccionalmente
- [ ] Estados de sincronización funcionales
- [ ] Errores se manejan y registran

### Importación Órdenes
- [ ] Órdenes ML se importan correctamente
- [ ] Estados se mapean adecuadamente
- [ ] Items se asocián con productos locales

### Webhooks
- [ ] Webhooks ML se reciben y procesan
- [ ] Webhooks MP continúan funcionando
- [ ] Retries funcionan para errores

### UI/Administración
- [ ] Panel de administración actualizado
- [ ] Botones de sincronización funcionales
- [ ] Estados visuales correctos
- [ ] Métricas se muestran correctamente

### Performance
- [ ] Sincronización no bloquea UI
- [ ] Consultas optimizadas con índices
- [ ] Logs no afectan performance

### Seguridad
- [ ] Validaciones de permisos funcionan
- [ ] Datos sensibles protegidos
- [ ] Rate limiting implementado
```

---

## 📈 RESUMEN DE IMPLEMENTACIÓN

### ✅ Componentes Reutilizados (85%)
- Autenticación OAuth ML
- Webhooks Mercado Pago  
- Esquema de productos y variantes
- Sistema de órdenes y stock
- Componentes UI admin

### 🆕 Componentes Nuevos (15%)
- 6 tablas específicas de integración
- Servicios de sincronización
- Endpoints adicionales API
- Sistema de métricas

### ⏱️ Tiempos Estimados
- **Día 1**: Base de datos (4-6 horas)
- **Día 2**: Servicios existentes (6-8 horas)
- **Día 3**: Nuevos endpoints (8 horas)
- **Día 4**: Componentes UI (6 horas)
- **Día 5**: Sincronización (8 horas)
- **Día 6**: Monitoreo (4 horas)
- **Día 7**: Testing (6 horas)

**Total**: 42-50 horas (1 semana completa)

### 🎯 Próximos Pasos
1. Ejecutar migración de base de datos
2. Implementar servicios fase por fase
3. Testing continuo durante desarrollo
4. Despliegue gradual con validación

El plan maximiza el código existente y minimiza cambios disruptivos, permitiendo una integración estable y escalable.
