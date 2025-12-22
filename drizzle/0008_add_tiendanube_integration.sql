ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tiendanube_store_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tiendanube_order_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tiendanube_shipping_id" text;

CREATE INDEX IF NOT EXISTS "orders_tiendanube_store_id_idx" ON "orders" ("tiendanube_store_id");
CREATE INDEX IF NOT EXISTS "orders_tiendanube_order_id_idx" ON "orders" ("tiendanube_order_id");
CREATE INDEX IF NOT EXISTS "orders_tiendanube_shipping_id_idx" ON "orders" ("tiendanube_shipping_id");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_tiendanube_store_order_unique" ON "orders" ("tiendanube_store_id", "tiendanube_order_id");

CREATE TABLE IF NOT EXISTS "tiendanube_stores" (
  "id" serial PRIMARY KEY,
  "store_id" text NOT NULL,
  "access_token_encrypted" text NOT NULL,
  "scopes" text,
  "status" varchar(50) NOT NULL DEFAULT 'connected',
  "installed_at" timestamp,
  "uninstalled_at" timestamp,
  "last_sync_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tiendanube_stores_store_id_unique" ON "tiendanube_stores" ("store_id");
CREATE INDEX IF NOT EXISTS "tiendanube_stores_status_idx" ON "tiendanube_stores" ("status");

CREATE TABLE IF NOT EXISTS "tiendanube_webhooks" (
  "id" serial PRIMARY KEY,
  "store_id" text NOT NULL,
  "event" text NOT NULL,
  "resource_id" text,
  "payload" jsonb NOT NULL,
  "hmac_valid" boolean NOT NULL DEFAULT false,
  "processed" boolean NOT NULL DEFAULT false,
  "processed_at" timestamp,
  "error_message" text,
  "retry_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tiendanube_webhooks_store_id_idx" ON "tiendanube_webhooks" ("store_id");
CREATE INDEX IF NOT EXISTS "tiendanube_webhooks_event_idx" ON "tiendanube_webhooks" ("event");
CREATE INDEX IF NOT EXISTS "tiendanube_webhooks_processed_idx" ON "tiendanube_webhooks" ("processed");

CREATE TABLE IF NOT EXISTS "tiendanube_product_mapping" (
  "id" serial PRIMARY KEY,
  "store_id" text NOT NULL,
  "local_product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "local_variant_id" integer REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "tiendanube_product_id" text,
  "tiendanube_variant_id" text,
  "sku" text NOT NULL,
  "sync_status" varchar(50) NOT NULL DEFAULT 'pending',
  "last_sync_at" timestamp,
  "last_error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tiendanube_product_mapping_store_sku_unique" ON "tiendanube_product_mapping" ("store_id", "sku");
CREATE INDEX IF NOT EXISTS "tiendanube_product_mapping_store_id_idx" ON "tiendanube_product_mapping" ("store_id");
CREATE INDEX IF NOT EXISTS "tiendanube_product_mapping_local_product_id_idx" ON "tiendanube_product_mapping" ("local_product_id");
CREATE INDEX IF NOT EXISTS "tiendanube_product_mapping_local_variant_id_idx" ON "tiendanube_product_mapping" ("local_variant_id");
CREATE INDEX IF NOT EXISTS "tiendanube_product_mapping_tiendanube_variant_id_idx" ON "tiendanube_product_mapping" ("tiendanube_variant_id");
CREATE INDEX IF NOT EXISTS "tiendanube_product_mapping_sync_status_idx" ON "tiendanube_product_mapping" ("sync_status");

CREATE TABLE IF NOT EXISTS "tiendanube_sync_state" (
  "id" serial PRIMARY KEY,
  "store_id" text NOT NULL,
  "resource" varchar(100) NOT NULL,
  "cursor" text,
  "last_synced_at" timestamp,
  "last_error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tiendanube_sync_state_store_resource_unique" ON "tiendanube_sync_state" ("store_id", "resource");
CREATE INDEX IF NOT EXISTS "tiendanube_sync_state_store_id_idx" ON "tiendanube_sync_state" ("store_id");

CREATE TABLE IF NOT EXISTS "tiendanube_customer_mapping" (
  "id" serial PRIMARY KEY,
  "store_id" text NOT NULL,
  "tiendanube_customer_id" text NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tiendanube_customer_mapping_store_customer_unique" ON "tiendanube_customer_mapping" ("store_id", "tiendanube_customer_id");
CREATE INDEX IF NOT EXISTS "tiendanube_customer_mapping_user_id_idx" ON "tiendanube_customer_mapping" ("user_id");
CREATE INDEX IF NOT EXISTS "tiendanube_customer_mapping_store_id_idx" ON "tiendanube_customer_mapping" ("store_id");
