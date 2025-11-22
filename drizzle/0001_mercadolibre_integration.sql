-- ========================================
-- MIGRACIÓN: Mercado Libre Integration
-- ========================================
-- Generado: 2025-06-22
-- Descripción: Extensión de tablas existentes y creación de nuevas tablas para integración con Mercado Libre y Mercado Pago

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

-- Crear enums para las nuevas tablas
DO $$ BEGIN
    CREATE TYPE "ml_sync_status" AS ENUM('pending', 'syncing', 'synced', 'error', 'conflict');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ml_import_status" AS ENUM('pending', 'imported', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ml_question_status" AS ENUM('pending', 'answered', 'closed', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "mp_preference_status" AS ENUM('pending', 'expired', 'active');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla de sincronización de productos ML
CREATE TABLE IF NOT EXISTS mercadolibre_products_sync (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  ml_item_id TEXT UNIQUE,
  sync_status "ml_sync_status" DEFAULT 'pending' NOT NULL,
  last_sync_at TIMESTAMP,
  sync_error TEXT,
  ml_data JSONB,
  sync_attempts INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabla de importación de órdenes ML
CREATE TABLE IF NOT EXISTS mercadolibre_orders_import (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  ml_order_id TEXT UNIQUE,
  import_status "ml_import_status" DEFAULT 'pending' NOT NULL,
  imported_at TIMESTAMP,
  import_error TEXT,
  ml_order_data JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabla de preguntas ML
CREATE TABLE IF NOT EXISTS mercadolibre_questions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  ml_question_id TEXT UNIQUE,
  ml_item_id TEXT,
  question_text TEXT NOT NULL,
  answer_text TEXT,
  status "ml_question_status" DEFAULT 'pending' NOT NULL,
  ml_buyer_id TEXT,
  ml_buyer_nickname TEXT,
  question_date TIMESTAMP,
  answer_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Webhooks de Mercado Libre
CREATE TABLE IF NOT EXISTS mercadolibre_webhooks (
  id SERIAL PRIMARY KEY,
  webhook_id TEXT UNIQUE,
  topic TEXT NOT NULL,
  resource TEXT,
  user_id INTEGER REFERENCES users(id),
  resource_id TEXT,
  application_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE NOT NULL,
  processed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
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
  expires BOOLEAN DEFAULT FALSE NOT NULL,
  expiration_date_from TIMESTAMP,
  expiration_date_to TIMESTAMP,
  notification_url TEXT,
  status "mp_preference_status" DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
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
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Métricas de integración
CREATE TABLE IF NOT EXISTS integration_metrics (
  id SERIAL PRIMARY KEY,
  date TIMESTAMP NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mercadolibre', 'mercadopago')),
  metric_name TEXT NOT NULL,
  metric_value INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ========================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ========================================

-- Índices para tablas extendidas
CREATE INDEX IF NOT EXISTS idx_products_ml_item_id ON products(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_products_ml_sync_status ON products(ml_sync_status);
CREATE INDEX IF NOT EXISTS idx_orders_ml_order_id ON orders(ml_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_users_ml_nickname ON users(ml_nickname);

-- Índices para nuevas tablas
CREATE INDEX IF NOT EXISTS idx_ml_sync_product_id ON mercadolibre_products_sync(product_id);
CREATE INDEX IF NOT EXISTS idx_ml_sync_ml_item_id ON mercadolibre_products_sync(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_ml_sync_status ON mercadolibre_products_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_ml_import_order_id ON mercadolibre_orders_import(order_id);
CREATE INDEX IF NOT EXISTS idx_ml_import_ml_order_id ON mercadolibre_orders_import(ml_order_id);
CREATE INDEX IF NOT EXISTS idx_ml_import_status ON mercadolibre_orders_import(import_status);
CREATE INDEX IF NOT EXISTS idx_ml_questions_product_id ON mercadolibre_questions(product_id);
CREATE INDEX IF NOT EXISTS idx_ml_questions_ml_item_id ON mercadolibre_questions(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_ml_questions_status ON mercadolibre_questions(status);
CREATE INDEX IF NOT EXISTS idx_ml_webhooks_user_id ON mercadolibre_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_webhooks_topic ON mercadolibre_webhooks(topic);
CREATE INDEX IF NOT EXISTS idx_ml_webhooks_processed ON mercadolibre_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_mp_preferences_order_id ON mercadopago_preferences(order_id);
CREATE INDEX IF NOT EXISTS idx_mp_preferences_user_id ON mercadopago_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_preferences_status ON mercadopago_preferences(status);
CREATE INDEX IF NOT EXISTS idx_mp_payments_payment_id ON mercadopago_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_preference_id ON mercadopago_payments(preference_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_order_id ON mercadopago_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_status ON mercadopago_payments(status);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_date ON integration_metrics(date);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_platform ON integration_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_metric_name ON integration_metrics(metric_name);

-- ========================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ========================================

COMMENT ON TABLE mercadolibre_products_sync IS 'Tabla para tracking de sincronización de productos con Mercado Libre';
COMMENT ON TABLE mercadolibre_orders_import IS 'Tabla para tracking de importación de órdenes desde Mercado Libre';
COMMENT ON TABLE mercadolibre_questions IS 'Tabla para gestionar preguntas y respuestas de Mercado Libre';
COMMENT ON TABLE mercadolibre_webhooks IS 'Tabla para procesar webhooks recibidos desde Mercado Libre';
COMMENT ON TABLE mercadopago_preferences IS 'Tabla mejorada para preferencias de pago de Mercado Pago';
COMMENT ON TABLE mercadopago_payments IS 'Tabla mejorada para registrar pagos de Mercado Pago';
COMMENT ON TABLE integration_metrics IS 'Tabla para métricas de rendimiento de la integración';
