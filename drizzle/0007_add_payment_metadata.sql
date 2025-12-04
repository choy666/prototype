-- drizzle/0007_add_payment_metadata.sql
-- Migration para agregar campos de pago y metadata a tabla orders

-- Agregar campo paymentStatus para seguimiento de estado de pago
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

-- Agregar campo metadata para auditoría y datos adicionales
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Crear índice para payment_status para consultas eficientes
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status);

-- Crear índice para metadata (parcial, solo para búsquedas comunes)
CREATE INDEX IF NOT EXISTS orders_metadata_gin_idx ON orders USING GIN(metadata);

-- Comentarios para documentación
COMMENT ON COLUMN orders.payment_status IS 'Estado del pago (pending, approved, rejected, etc.)';
COMMENT ON COLUMN orders.metadata IS 'Metadata adicional para auditoría, confirmaciones manuales y tracking';

-- Actualizar timestamps
UPDATE orders SET updated_at = NOW() WHERE updated_at IS NOT NULL;
