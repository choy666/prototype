CREATE TABLE IF NOT EXISTS "stock_logs" (
  "id" serial PRIMARY KEY,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "variant_id" integer REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "old_stock" integer NOT NULL,
  "new_stock" integer NOT NULL,
  "change" integer NOT NULL,
  "reason" text NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "stock_logs_product_id_idx" ON "stock_logs" ("product_id");
CREATE INDEX IF NOT EXISTS "stock_logs_variant_id_idx" ON "stock_logs" ("variant_id");
CREATE INDEX IF NOT EXISTS "stock_logs_created_at_idx" ON "stock_logs" ("created_at" DESC);
