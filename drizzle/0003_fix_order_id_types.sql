-- ========================================
-- MIGRACIÓN: Corregir tipos de order_id
-- ========================================
-- Descripción: Convertir order_id de varchar a integer en tablas que lo requieren
-- Problema: Drizzle espera integer pero la DB tiene varchar

-- Convertir order_id en shipment_history de varchar a integer
-- Primero verificamos que no haya datos no numéricos
DO $$
BEGIN
    -- Verificar si hay datos no numéricos en order_id
    IF EXISTS (SELECT 1 FROM shipment_history WHERE order_id ~ '[^0-9]') THEN
        RAISE EXCEPTION 'Hay datos no numéricos en shipment_history.order_id. Por favor limpie los datos antes de continuar.';
    END IF;
END $$;

-- Convertir la columna
ALTER TABLE shipment_history ALTER COLUMN order_id TYPE integer USING order_id::integer;

-- Actualizar el foreign key para que sea más explícito
DROP INDEX IF EXISTS "shipment_history_order_id_idx";
CREATE INDEX "shipment_history_order_id_idx" ON shipment_history (order_id);

-- Repetir proceso para otras tablas si es necesario
-- (Verificar si hay otras tablas con el mismo problema)

COMENTARIO ON TABLE shipment_history IS 'Historial de cambios de estado de los envíos (corregido order_id a integer)';
