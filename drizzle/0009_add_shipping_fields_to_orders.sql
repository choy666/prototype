-- Agregar campos de envío a la tabla orders
-- Para soportar Envío Nube y envíos locales

ALTER TABLE orders 
ADD COLUMN shipping_method VARCHAR(50) DEFAULT 'local',
ADD COLUMN shipping_cost DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN shipping_address JSONB,
ADD COLUMN tracking_code VARCHAR(100),
ADD COLUMN shipping_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN carrier_name VARCHAR(100),
ADD COLUMN estimated_delivery DATE,
ADD COLUMN shipping_notes TEXT,
ADD COLUMN tiendanube_shipping_id VARCHAR(100);

-- Crear índices para optimizar consultas
CREATE INDEX idx_orders_shipping_status ON orders(shipping_status);
CREATE INDEX idx_orders_shipping_method ON orders(shipping_method);
CREATE INDEX idx_orders_tracking_code ON orders(tracking_code);

-- Crear tabla para configuración de envíos locales
CREATE TABLE IF NOT EXISTS shipping_settings (
  id SERIAL PRIMARY KEY,
  business_zip_code VARCHAR(10) NOT NULL,
  local_shipping_cost DECIMAL(10, 2) DEFAULT 0,
  local_shipping_radius INTEGER DEFAULT 10, -- km
  free_shipping_threshold DECIMAL(10, 2) DEFAULT 0,
  tiendanube_store_id VARCHAR(20) DEFAULT '7078702',
  tiendanube_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insertar configuración inicial
INSERT INTO shipping_settings (business_zip_code, local_shipping_cost, free_shipping_threshold)
VALUES ('1001', 0, 50000)
ON CONFLICT DO NOTHING;

-- Actualizar el enum de shipping_status si es necesario
ALTER TYPE shipping_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE shipping_status ADD VALUE IF NOT EXISTS 'ready_for_pickup';
