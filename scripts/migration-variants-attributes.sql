-- Migración para unificar atributos en product_variants
-- Ejecutar en local y servidor (ej. via pgAdmin, psql o Neon console)

-- Paso 1: Merge attributes a additional_attributes si attributes no es null y no vacío
UPDATE product_variants 
SET additional_attributes = COALESCE(additional_attributes, '{}')::jsonb || attributes::jsonb
WHERE attributes IS NOT NULL AND attributes != '{}';

-- Paso 2: Establecer attributes a null para variantes sin datos (opcional, para limpieza)
UPDATE product_variants 
SET attributes = NULL 
WHERE attributes = '{}' OR attributes IS NULL;

-- Paso 3: Drop the column attributes
ALTER TABLE product_variants DROP COLUMN IF EXISTS attributes;

-- Verificación: Consulta para variante 77
SELECT id, additional_attributes FROM product_variants WHERE id = 77;

-- Para todas las variantes
SELECT id, additional_attributes FROM product_variants WHERE additional_attributes IS NOT NULL AND additional_attributes != '{}';
