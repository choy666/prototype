CREATE TABLE IF NOT EXISTS "tiendanube_shipping_quotes" (
  "id" serial PRIMARY KEY,
  "cart_id" text,
  "quote_key" text NOT NULL,
  "store_id" text NOT NULL,
  "destination_zip" varchar(10) NOT NULL,
  "payload" jsonb,
  "options" jsonb NOT NULL,
  "source" varchar(20) NOT NULL DEFAULT 'tiendanube',
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tiendanube_shipping_quotes_quote_key_idx"
  ON "tiendanube_shipping_quotes" ("quote_key");

CREATE INDEX IF NOT EXISTS "tiendanube_shipping_quotes_cart_idx"
  ON "tiendanube_shipping_quotes" ("cart_id");

CREATE INDEX IF NOT EXISTS "tiendanube_shipping_quotes_expires_idx"
  ON "tiendanube_shipping_quotes" ("expires_at");
