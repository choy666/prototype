-- Add variantId to stockLogs for better variant tracking
ALTER TABLE "stock_logs" ADD COLUMN "variant_id" integer REFERENCES "product_variants"("id") ON DELETE CASCADE;
