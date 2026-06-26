import {
  pgTable,
  serial,
  text,
  decimal,
  boolean,
  integer,
  timestamp,
  varchar,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ======================
// Enums para Webhooks
// ======================
export const webhookStatusEnum = pgEnum('webhook_status', [
  'failed',
  'retrying',
  'success',
  'dead_letter',
]);

// ======================
// Webhooks Fallidos
// ======================
export const webhookFailures = pgTable(
  'webhook_failures',
  {
    id: serial('id').primaryKey(),
    paymentId: text('payment_id').notNull(), // ID del pago de Mercado Pago
    requestId: text('request_id').notNull(), // UUID para correlación
    rawBody: jsonb('raw_body').notNull(), // Payload completo
    headers: jsonb('headers').notNull(), // Headers del request
    errorMessage: text('error_message'), // Error principal
    errorStack: text('error_stack'), // Stack completo si aplica
    clientIp: text('client_ip'), // IP de origen para análisis
    retryCount: integer('retry_count').default(0).notNull(), // Contador de reintentos
    status: webhookStatusEnum('status').default('failed').notNull(), // Estado actual
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastRetryAt: timestamp('last_retry_at'), // Último intento de retry
    nextRetryAt: timestamp('next_retry_at'), // Próximo retry programado
    processedAt: timestamp('processed_at'), // Cuándo se procesó exitosamente
  },
  (table) => ({
    // Índice para consultas de admin dashboard por pago
    paymentIdx: index('webhook_failures_payment_idx').on(table.paymentId, table.createdAt.desc()),
    // Índice compuesto para cola de reintentos
    retryQueueIdx: index('webhook_failures_retry_queue_idx').on(table.status, table.nextRetryAt),
    // Índice para análisis por estado
    statusIdx: index('webhook_failures_status_idx').on(table.status),
    // Índice para correlación con logs
    requestIdIdx: index('webhook_failures_request_id_idx').on(table.requestId),
  })
);

// ======================
// Webhook Replay Cache (Prevención de ataques)
// ======================
export const webhookReplayCache = pgTable(
  'webhook_replay_cache',
  {
    requestId: varchar('request_id', { length: 255 }).primaryKey(), // x-request-id único
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(), // Para limpieza automática
  },
  (table) => ({
    // Índice para limpieza de registros expirados
    expiresIdx: index('webhook_replay_cache_expires_idx').on(table.expiresAt),
    // Índice para búsquedas rápidas
    requestIdIdx: index('webhook_replay_cache_request_idx').on(table.requestId),
  })
);

// ======================
// User roles type
// ======================
export type UserRole = 'user' | 'admin';

// ======================
// Categorías
// ======================
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  mlCategoryId: text('ml_category_id').unique(), // ID de categoría de Mercado Libre
  isMlOfficial: boolean('is_ml_official').default(false).notNull(), // Indica si es categoría oficial de ML
  isLeaf: boolean('is_leaf').default(false).notNull(), // Indica si es categoría hoja (se puede usar para publicar)
  // Nuevos campos ME2
  attributes: jsonb('attributes'), // Atributos de la categoría desde ML API
  me2Compatible: boolean('me2_compatible').default(false), // Indica si la categoría tiene atributos suficientes para ME2
  mlSettings: jsonb('ml_settings'), // Configuración adicional (listing_types, price ranges, etc.)
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// ======================
// Productos
// ======================
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  image: text('image'), // imagen principal
  images: jsonb('images'), // array de urls de imágenes adicionales
  categoryId: integer('category_id').references(() => categories.id),
  category: text('category').notNull(), // mantener para compatibilidad
  destacado: boolean('destacado').default(false).notNull(),
  stock: integer('stock').default(0).notNull(),
  discount: integer('discount').default(0).notNull(), // porcentaje de descuento
  weight: decimal('weight', { precision: 5, scale: 2 }), // peso en kg, opcional para cálculo de envío
  height: decimal('height', { precision: 5, scale: 2 }), // altura en cm, para cálculo de envío ME2
  width: decimal('width', { precision: 5, scale: 2 }), // ancho en cm, para cálculo de envío ME2
  length: decimal('length', { precision: 5, scale: 2 }), // largo en cm, para cálculo de envío ME2
  attributes: jsonb('attributes'), // atributos dinámicos del producto
  isActive: boolean('is_active').default(true).notNull(),
  // Nuevos campos para Mercado Libre
  mlItemId: text('ml_item_id').unique(),
  mlCategoryId: text('ml_category_id'),
  mlListingTypeId: text('ml_listing_type_id'),
  mlCondition: text('ml_condition').default('new'),
  mlBuyingMode: text('ml_buying_mode').default('buy_it_now'),
  mlCurrencyId: text('ml_currency_id').default('ARS'),
  mlSyncStatus: text('ml_sync_status').default('pending'),
  mlLastSync: timestamp('ml_last_sync'),
  mlPermalink: text('ml_permalink'),
  mlThumbnail: text('ml_thumbnail'),
  mlVideoId: text('ml_video_id'),
  // Nuevos campos ME2
  shippingMode: varchar('shipping_mode', { length: 20 }).default('me2'), // Modo de envío ML
  shippingAttributes: jsonb('shipping_attributes'), // Atributos de envío específicos para ME2
  me2Compatible: boolean('me2_compatible').default(false), // Indica si el producto es compatible con ME2
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// ======================
// Historial de movimientos de stock
// ======================
export const stockLogs = pgTable('stock_logs', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  oldStock: integer('old_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  change: integer('change').notNull(), // cantidad cambiada (positiva o negativa)
  reason: text('reason').notNull(), // razón del cambio (ej: "Ajuste manual", "Venta", "Devolución")
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ======================
// Usuarios
// ======================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 256 }).unique().notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  // Documento del usuario (para integraciones de pago, ej. Mercado Pago)
  documentType: varchar('document_type', { length: 10 }), // Ej: DNI, CUIT
  documentNumber: varchar('document_number', { length: 20 }),
  password: varchar('password', { length: 256 }), // Para autenticación tradicional
  emailVerified: timestamp('email_verified'),
  image: text('image'),
  role: text('role', { enum: ['user', 'admin'] })
    .default('user')
    .notNull(),
  mercadoLibreId: varchar('mercado_libre_id', { length: 100 }), // Para OAuth
  mercadoLibreAccessToken: text('mercado_libre_access_token'),
  mercadoLibreRefreshToken: text('mercado_libre_refresh_token'),
  mercadoLibreScopes: text('mercado_libre_scopes'), // Scopes autorizados separados por comas
  mercadoLibreAccessTokenExpiresAt: timestamp('mercado_libre_access_token_expires_at'),
  mercadoLibreRefreshTokenExpiresAt: timestamp('mercado_libre_refresh_token_expires_at'),
  // Nuevos campos para Mercado Libre
  mlNickname: text('ml_nickname'),
  mlSiteId: text('ml_site_id').default('MLA'),
  mlSellerId: text('ml_seller_id'),
  mlPermalink: text('ml_permalink'),
  mlLevelId: text('ml_level_id'),
  mlNeedsReauth: boolean('ml_needs_reauth').default(false).notNull(),
  mlReauthReason: text('ml_reauth_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ======================
// Carrito
// ======================
export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ======================
// Ítems del carrito
// ======================
export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id')
    .references(() => carts.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  quantity: integer('quantity').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ======================
// Enum de estados de orden
// ======================
export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
  'rejected',
  'processing', // Nuevo estado para envíos ML
  'failed', // Nuevo estado para envíos fallidos
  'returned', // Nuevo estado para devoluciones
]);

// ======================
// Enum de estados de envío (ML)
// ======================
export const shippingStatusEnum = pgEnum('shipping_status', [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'failed',
  'cancelled',
  'returned',
]);

// ======================
// Modos de envío de Mercado Libre
// ======================
export const mlShippingModes = pgTable(
  'ml_shipping_modes',
  {
    id: serial('id').primaryKey(),
    mlModeId: varchar('ml_mode_id', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('ml_shipping_modes_ml_mode_id_unique').on(table.mlModeId)]
);

// ======================
// Historial de envíos
// ======================
export const shipmentHistory = pgTable(
  'shipment_history',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    shipmentId: varchar('shipment_id', { length: 50 }),
    status: varchar('status', { length: 50 }).notNull(),
    substatus: varchar('substatus', { length: 50 }),
    comment: text('comment'),
    trackingNumber: varchar('tracking_number', { length: 100 }),
    trackingUrl: text('tracking_url'),
    dateCreated: timestamp('date_created').notNull(),
    source: varchar('source', { length: 50 }).default('mercadolibre'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('shipment_history_order_id_idx').on(table.orderId),
    index('shipment_history_shipment_id_idx').on(table.shipmentId),
    index('shipment_history_status_idx').on(table.status),
    index('shipment_history_date_created_idx').on(table.dateCreated),
  ]
);

// ======================
// Webhooks de envíos
// ======================
export const shipmentWebhooks = pgTable(
  'shipment_webhooks',
  {
    id: serial('id').primaryKey(),
    applicationId: varchar('application_id', { length: 50 }).notNull(),
    userId: varchar('user_id', { length: 50 }).notNull(),
    topic: varchar('topic', { length: 50 }).notNull(),
    resourceUrl: text('resource_url').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastProcessed: timestamp('last_processed'),
    failureCount: integer('failure_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('shipment_webhooks_application_user_topic_unique').on(
      table.applicationId,
      table.userId,
      table.topic
    ),
  ]
);

// ======================
// Direcciones de envío
// ======================
export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  nombre: varchar('nombre', { length: 256 }).notNull(),
  direccion: text('direccion').notNull(),
  numero: varchar('numero', { length: 20 }).notNull(),
  ciudad: varchar('ciudad', { length: 256 }).notNull(),
  provincia: varchar('provincia', { length: 256 }).notNull(),
  codigoPostal: varchar('codigo_postal', { length: 10 }).notNull(),
  telefono: varchar('telefono', { length: 20 }).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ======================
// Métodos de envío
// ======================
export const shippingMethods = pgTable('shipping_methods', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // ej: "Envío Estándar", "Envío Express"
  baseCost: decimal('base_cost', { precision: 10, scale: 2 }).notNull(), // costo base
  weightMultiplier: decimal('weight_multiplier', { precision: 5, scale: 2 }).default('0').notNull(), // multiplicador por kg
  zoneMultiplier: decimal('zone_multiplier', { precision: 5, scale: 2 }).default('1').notNull(), // multiplicador por zona
  freeThreshold: decimal('free_threshold', { precision: 10, scale: 2 }), // monto mínimo para envío gratis
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ======================
// Órdenes
// ======================
export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    email: varchar('email', { length: 256 }), // Permitir null inicialmente
    total: decimal('total', { precision: 10, scale: 2 }).notNull(),
    status: orderStatusEnum('status').default('pending').notNull(), // Estado logístico
    shippingStatus: shippingStatusEnum('shipping_status').default('pending'), // Estado de envío ML
    paymentId: text('payment_id'),
    mercadoPagoId: text('mercado_pago_id'),
    shippingAddress: jsonb('shipping_address'),
    shippingAddressId: integer('shipping_address_id').references(() => addresses.id),
    shippingMethodId: integer('shipping_method_id').references(() => shippingMethods.id),
    shippingCost: decimal('shipping_cost', { precision: 10, scale: 2 }).default('0').notNull(),
    trackingNumber: text('tracking_number'), // Número de seguimiento
    trackingUrl: text('tracking_url'), // URL de seguimiento
    shippingMode: varchar('shipping_mode', { length: 20 }).default('me2'), // Modo de envío ML
    cancellationReason: text('cancellation_reason'), // Razón de cancelación
    cancelledAt: timestamp('cancelled_at'), // Fecha de cancelación
    // Nuevos campos para Mercado Libre
    mercadoLibreShipmentId: varchar('mercado_libre_shipment_id', { length: 50 }), // ID del shipment en ML
    mercadoLibreAddressId: varchar('mercado_libre_address_id', { length: 50 }), // ID dirección en ML
    mercadoLibreShipmentStatus: varchar('mercado_libre_shipment_status', { length: 50 }), // Estado shipment ML
    mercadoLibreShipmentSubstatus: varchar('mercado_libre_shipment_substatus', { length: 50 }), // Subestado ML
    mlOrderId: text('ml_order_id').unique(),
    source: text('source').default('local'),
    // Información de sucursal para envíos a agencia
    shippingAgency: jsonb('shipping_agency'), // Datos de la sucursal seleccionada
    mlStatus: text('ml_status'),
    mlBuyerInfo: jsonb('ml_buyer_info'),
    mlShippingInfo: jsonb('ml_shipping_info'),
    mlPaymentInfo: jsonb('ml_payment_info'),
    mlFeedback: jsonb('ml_feedback'),
    stockDeducted: boolean('stock_deducted').default(false).notNull(),
    // Nuevos campos para pagos y metadata
    paymentStatus: varchar('payment_status', { length: 50 }).default('pending'), // Estado del pago
    metadata: jsonb('metadata'), // Metadata adicional para auditoría
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('orders_mercado_libre_shipment_id_idx').on(table.mercadoLibreShipmentId),
    index('orders_shipping_status_idx').on(table.shippingStatus),
    index('orders_shipping_mode_idx').on(table.shippingMode),
    uniqueIndex('orders_payment_id_unique').on(table.paymentId),
  ]
);

// ======================
// Ítems de la orden
// ======================
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ======================
// Notificaciones para administradores
// ======================
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    type: text('type').notNull(), // ej: "order_cancelled", "new_order", etc.
    title: text('title').notNull(),
    message: text('message').notNull(),
    data: jsonb('data'), // datos adicionales (orderId, userId, etc.)
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notifications_is_read_idx').on(table.isRead),
    index('notifications_created_at_idx').on(table.createdAt),
  ]
);

// ======================
// Tipos TypeScript
// ======================
export type User = typeof users.$inferSelect;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type NewProduct = typeof products.$inferInsert;
export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
export type ShippingMethod = typeof shippingMethods.$inferSelect;
export type NewShippingMethod = typeof shippingMethods.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type StockLog = typeof stockLogs.$inferSelect;
export type NewStockLog = typeof stockLogs.$inferInsert;

// ======================
// Atributos de productos (mapeados a catálogo ML)
// ======================
export const productAttributes = pgTable(
  'product_attributes',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(), // ej: "Talla", "Color", "Material"
    mlAttributeId: text('ml_attribute_id'), // ID del atributo en catálogo ML
    values: jsonb('values').notNull(), // [{name: "Rojo", mlValueId: "52049"}, {name: "Azul", mlValueId: "52051"}]
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('product_attributes_name_unique').on(table.name),
    index('product_attributes_name_idx').on(table.name),
    index('product_attributes_ml_attribute_id_idx').on(table.mlAttributeId),
  ]
);

// ======================
// Variantes de productos (compatible con Mercado Libre)
// ======================
export const productVariants = pgTable(
  'product_variants',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name'), // Nombre personalizado de variante
    description: text('description'), // Descripción específica de variante
    // Atributos para ML (mapeados a IDs de catálogo ML)
    mlAttributeCombinations: jsonb('ml_attribute_combinations'), // [{id: "83000", name: "Color", value_id: "52049", value_name: "Negro"}]
    additionalAttributes: jsonb('additional_attributes'), // Atributos adicionales específicos
    price: decimal('price', { precision: 10, scale: 2 }), // precio específico de variante
    stock: integer('stock').default(0).notNull(),
    images: jsonb('images'), // array de urls de imágenes
    isActive: boolean('is_active').default(true).notNull(),
    // Campos de sincronización con ML
    mlVariationId: text('ml_variation_id'), // ID de la variación en ML
    mlSyncStatus: text('ml_sync_status').default('pending'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('product_variants_product_id_idx').on(table.productId),
    index('product_variants_is_active_idx').on(table.isActive),
    index('product_variants_product_active_idx').on(table.productId, table.isActive),
    index('product_variants_ml_variation_id_idx').on(table.mlVariationId),
  ]
);

// ======================
// Tipos TypeScript para atributos y variantes
// ======================
export type ProductAttribute = typeof productAttributes.$inferSelect;
export type NewProductAttribute = typeof productAttributes.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

// Tipos sin SKU para compatibilidad
export type ProductVariantWithoutSKU = Omit<ProductVariant, 'sku'>;
export type NewProductVariantWithoutSKU = Omit<NewProductVariant, 'sku'>;

// ======================
// Enums para Mercado Libre
// ======================
export const mlSyncStatusEnum = pgEnum('ml_sync_status', [
  'pending',
  'syncing',
  'synced',
  'error',
  'conflict',
]);

export const mlImportStatusEnum = pgEnum('ml_import_status', ['pending', 'imported', 'error']);

export const mlQuestionStatusEnum = pgEnum('ml_question_status', [
  'pending',
  'answered',
  'closed',
  'deleted',
]);

export const mpPreferenceStatusEnum = pgEnum('mp_preference_status', [
  'pending',
  'expired',
  'active',
]);

// ======================
// Tabla de sincronización de productos ML
// ======================
export const mercadolibreProductsSync = pgTable(
  'mercadolibre_products_sync',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    mlItemId: text('ml_item_id').unique(),
    syncStatus: mlSyncStatusEnum('sync_status').default('pending').notNull(),
    lastSyncAt: timestamp('last_sync_at'),
    syncError: text('sync_error'),
    mlData: jsonb('ml_data'),
    syncAttempts: integer('sync_attempts').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('ml_sync_product_id_idx').on(table.productId),
    index('ml_sync_ml_item_id_idx').on(table.mlItemId),
    index('ml_sync_status_idx').on(table.syncStatus),
  ]
);

// ======================
// Tabla de importación de órdenes ML
// ======================
export const mercadolibreOrdersImport = pgTable(
  'mercadolibre_orders_import',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    mlOrderId: text('ml_order_id').unique(),
    importStatus: mlImportStatusEnum('import_status').default('pending').notNull(),
    importedAt: timestamp('imported_at'),
    importError: text('import_error'),
    mlOrderData: jsonb('ml_order_data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('ml_import_order_id_idx').on(table.orderId),
    index('ml_import_ml_order_id_idx').on(table.mlOrderId),
    index('ml_import_status_idx').on(table.importStatus),
  ]
);

// ======================
// Tabla de preguntas ML
// ======================
export const mercadolibreQuestions = pgTable(
  'mercadolibre_questions',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    mlQuestionId: text('ml_question_id').unique(),
    mlItemId: text('ml_item_id'),
    questionText: text('question_text').notNull(),
    answerText: text('answer_text'),
    status: mlQuestionStatusEnum('status').default('pending').notNull(),
    mlBuyerId: text('ml_buyer_id'),
    mlBuyerNickname: text('ml_buyer_nickname'),
    questionDate: timestamp('question_date'),
    answerDate: timestamp('answer_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('ml_questions_product_id_idx').on(table.productId),
    index('ml_questions_ml_item_id_idx').on(table.mlItemId),
    index('ml_questions_status_idx').on(table.status),
  ]
);

// ======================
// Webhooks de Mercado Libre
// ======================
export const mercadolibreWebhooks = pgTable(
  'mercadolibre_webhooks',
  {
    id: serial('id').primaryKey(),
    webhookId: text('webhook_id').unique(),
    topic: text('topic').notNull(),
    resource: text('resource'),
    userId: integer('user_id').references(() => users.id),
    resourceId: text('resource_id'),
    applicationId: text('application_id'),
    requestId: text('request_id'),
    signature: text('signature'),
    headers: jsonb('headers'),
    rawPayload: text('raw_payload'),
    payload: jsonb('payload').notNull(),
    status: webhookStatusEnum('status').default('retrying').notNull(),
    processed: boolean('processed').default(false).notNull(),
    processedAt: timestamp('processed_at'),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('ml_webhooks_user_id_idx').on(table.userId),
    index('ml_webhooks_topic_idx').on(table.topic),
    index('ml_webhooks_processed_idx').on(table.processed),
    index('ml_webhooks_request_id_idx').on(table.requestId),
  ]
);

// ======================
// Preferencias de Mercado Pago (mejorado)
// ======================
export const mercadopagoPreferences = pgTable(
  'mercadopago_preferences',
  {
    id: serial('id').primaryKey(),
    preferenceId: text('preference_id').unique(),
    externalReference: text('external_reference').unique(),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    userId: integer('user_id').references(() => users.id),
    initPoint: text('init_point'),
    items: jsonb('items').notNull(),
    payer: jsonb('payer'),
    paymentMethods: jsonb('payment_methods'),
    expires: boolean('expires').default(false).notNull(),
    expirationDateFrom: timestamp('expiration_date_from'),
    expirationDateTo: timestamp('expiration_date_to'),
    notificationUrl: text('notification_url'),
    status: mpPreferenceStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('mp_preferences_order_id_idx').on(table.orderId),
    index('mp_preferences_user_id_idx').on(table.userId),
    index('mp_preferences_status_idx').on(table.status),
  ]
);

// ======================
// Pagos de Mercado Pago (mejorado)
// ======================
export const mercadopagoPayments = pgTable(
  'mercadopago_payments',
  {
    id: serial('id').primaryKey(),
    paymentId: text('payment_id').unique(),
    preferenceId: text('preference_id'),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    status: text('status'),
    paymentMethodId: text('payment_method_id'),
    paymentMethodType: text('payment_method_type'),
    paymentMethodName: text('payment_method_name'),
    amount: decimal('amount', { precision: 10, scale: 2 }),
    currencyId: text('currency_id').default('ARS'),
    installments: integer('installments'),
    issuerId: text('issuer_id'),
    description: text('description'),
    externalReference: text('external_reference'),
    statementDescriptor: text('statement_descriptor'),
    dateCreated: timestamp('date_created'),
    dateApproved: timestamp('date_approved'),
    dateLastUpdated: timestamp('date_last_updated'),
    rawData: jsonb('raw_data'),
    // Campos de auditoría HMAC
    requiresManualVerification: boolean('requires_manual_verification').default(false).notNull(),
    hmacValidationResult: text('hmac_validation_result'), // 'valid', 'invalid', 'fallback_used'
    hmacFailureReason: text('hmac_failure_reason'), // razón específica del fallo HMAC
    hmacFallbackUsed: boolean('hmac_fallback_used').default(false).notNull(),
    verificationTimestamp: timestamp('verification_timestamp'), // cuándo se verificó
    webhookRequestId: text('webhook_request_id'), // correlación con webhook_failures
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('mp_payments_payment_id_idx').on(table.paymentId),
    index('mp_payments_preference_id_idx').on(table.preferenceId),
    index('mp_payments_order_id_idx').on(table.orderId),
    index('mp_payments_status_idx').on(table.status),
    index('mp_payments_requires_manual_verification_idx').on(table.requiresManualVerification),
  ]
);

// ======================
// Configuración del Negocio
// ======================
export const businessSettings = pgTable(
  'business_settings',
  {
    id: serial('id').primaryKey(),
    businessName: text('business_name').notNull(),
    description: text('description'),
    zipCode: varchar('zip_code', { length: 10 }).notNull(), // CP para envíos internos
    address: text('address').notNull(),
    phoneNumber: varchar('phone_number', { length: 20 }),
    email: varchar('email', { length: 255 }),
    whatsapp: varchar('whatsapp', { length: 20 }),
    location: jsonb('location'), // { lat: number, lng: number }
    schedule: jsonb('schedule'), // { dias: [{ dia: string, abierto: boolean, horarios: string[] }] }
    socialMedia: jsonb('social_media'), // { facebook: string, instagram: string, twitter: string, etc }
    images: jsonb('images'), // [{ url: string, alt: string }]
    shippingConfig: jsonb('shipping_config'), // { freeShippingThreshold: number, internalShippingCost: number }
    purchaseProtected: boolean('purchase_protected').default(true).notNull(),
    iframeUrl: text('iframe_url'), // URL del iframe para mostrar en página nosotros
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('business_settings_zip_code_idx').on(table.zipCode)]
);

// ======================
// Métricas de integración
// ======================
export const integrationMetrics = pgTable(
  'integration_metrics',
  {
    id: serial('id').primaryKey(),
    date: timestamp('date').notNull(),
    platform: text('platform').notNull(),
    metricName: text('metric_name').notNull(),
    metricValue: integer('metric_value').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('integration_metrics_date_idx').on(table.date),
    index('integration_metrics_platform_idx').on(table.platform),
    index('integration_metrics_metric_name_idx').on(table.metricName),
  ]
);

// ======================
// Relaciones de la base de datos
// ======================
export const mercadolibreWebhooksRelations = relations(mercadolibreWebhooks, ({ one }) => ({
  user: one(users, {
    fields: [mercadolibreWebhooks.userId],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  variants: many(productVariants),
  mlSync: one(mercadolibreProductsSync, {
    fields: [products.id],
    references: [mercadolibreProductsSync.productId],
  }),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

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
export type BusinessSettings = typeof businessSettings.$inferSelect;
export type NewBusinessSettings = typeof businessSettings.$inferInsert;
