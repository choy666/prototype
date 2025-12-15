-- Agregar campo shipping_agency a la tabla orders
ALTER TABLE "orders" ADD COLUMN "shipping_agency" jsonb;

-- Crear índice para búsquedas rápidas
CREATE INDEX "orders_shipping_agency_idx" ON "orders" USING GIN ("shipping_agency");

-- Comentario sobre el campo
COMMENT ON COLUMN "orders"."shipping_agency" IS 'Datos de la sucursal seleccionada para envíos a agencia (id, name, address, phone, hours)';
