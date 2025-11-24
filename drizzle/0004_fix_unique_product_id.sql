-- Agregar restricción UNIQUE a product_id en mercadolibre_products_sync
-- Esto permite que onConflictDoUpdate funcione correctamente

-- Eliminar índice duplicado si existe
DROP INDEX IF EXISTS "ml_sync_product_id_idx";

-- Agregar restricción UNIQUE
ALTER TABLE "mercadolibre_products_sync" ADD CONSTRAINT "mercadolibre_products_sync_product_id_unique" UNIQUE ("product_id");

-- Recrear índice (opcional, ya que UNIQUE crea un índice automáticamente)
CREATE INDEX IF NOT EXISTS "ml_sync_product_id_idx" ON "mercadolibre_products_sync"("product_id");
