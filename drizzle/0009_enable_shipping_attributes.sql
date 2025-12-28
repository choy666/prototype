-- Ensure shipping attributes/ME2 defaults exist for products
ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "shipping_attributes" jsonb;

ALTER TABLE "products"
ALTER COLUMN "shipping_attributes" SET DEFAULT '{}'::jsonb;

ALTER TABLE "products"
ALTER COLUMN "shipping_mode" SET DEFAULT 'me2';

UPDATE "products"
SET
  "shipping_mode" = COALESCE("shipping_mode", 'me2'),
  "shipping_attributes" = COALESCE("shipping_attributes", '{}'::jsonb);

COMMENT ON COLUMN "products"."shipping_attributes" IS 'Atributos avanzados de envío para Mercado Envíos (logistic_type, handling_time, etc.)';
