-- Migration para agregar campos de Mercado Libre a variantes de productos
-- Fecha: 2025-01-24

-- Agregar campos para sincronización con Mercado Libre en tabla de variantes
ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS ml_attribute_combinations JSONB,
ADD COLUMN IF NOT EXISTS ml_variation_id TEXT,
ADD COLUMN IF NOT EXISTS ml_sync_status TEXT DEFAULT 'pending';

-- Crear índices para mejor performance en queries de sincronización
CREATE INDEX IF NOT EXISTS idx_product_variants_ml_variation_id 
ON product_variants(ml_variation_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_ml_sync_status 
ON product_variants(ml_sync_status);

-- Crear índice compuesto para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_product_variants_product_ml_status 
ON product_variants(product_id, ml_sync_status);

-- Índice compuesto para webhooks de ML (optimización)
CREATE INDEX IF NOT EXISTS idx_product_variants_product_ml_variation 
ON product_variants(product_id, ml_variation_id);

-- Comentarios para documentación
COMMENT ON COLUMN product_variants.ml_attribute_combinations IS 'Atributos de Mercado Libre para variaciones (formato: [{id: "83000", name: "Color", value_id: "52049", value_name: "Negro"}])';
COMMENT ON COLUMN product_variants.ml_variation_id IS 'ID de la variación en Mercado Libre';
COMMENT ON COLUMN product_variants.ml_sync_status IS 'Estado de sincronización con ML: pending, syncing, synced, error, conflict';
